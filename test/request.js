'use strict';

import HttpsAgent from 'agentkeepalive';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import zlib from 'zlib';
import Request from '../lib/request.js';
import exp from 'constants';

chai.use(chaiAsPromised);

describe('Request', () => {
  const request = new Request('api.bigcommerce.com', {
    headers: { 'Content-Type': 'application/json' },
  });

  afterEach(() => nock.cleanAll());

  context('given a missing hostname', () => {
    it('should return an error if hostname is missing', () => {
      /* eslint no-new: off */
      expect(() => {
        new Request();
      }).to.throw(Error);
    });
  });

  context('given a 429 status code', () => {
    let ordersCall;
    beforeEach(() => {
      ordersCall = nock('https://api.bigcommerce.com')
        .post('/orders')
        .reply(429, {}, { 'X-Retry-After': 0.1 })
        .post('/orders')
        .reply(200, {});
    });

    it('should retry the request', async () => {
      try {
        const result = await request.run('post', '/orders');
        expect(result).to.be.an('object');
        expect(ordersCall.isDone()).to.be.true;
      } catch (e) {
        expect.fail('You shall not pass!');
      }
    });

    context('given a failOnLimitReached option', () => {
      const failRequest = new Request('api.bigcommerce.com', {
        headers: { 'Content-Type': 'application/json' },
        failOnLimitReached: true,
      });

      it('should return an error', () => {
        expect(failRequest.run('post', '/orders'))
          .to.be.rejectedWith('rate limit')
          .and.eventually.have.property('retryAfter', 0.1);
      });
    });
  });

  context('given a bad request or internal error is returned', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com').post('/orders').reply(400, {});
    });

    it('should return an error', () => {
      expect(request.run('post', '/orders', {})).to.be.rejectedWith(
        'Request returned error code'
      );
    });
  });

  context('if "error" are found in the response JSON', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com')
        .post('/orders')
        .reply(200, { error: 'An error has occurred.' });
    });

    it('should return an error', () => {
      expect(request.run('post', '/orders', {})).to.be.rejectedWith(
        'An error has occurred'
      );
    });
  });

  context('if "errors" are found in the response JSON', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com')
        .post('/orders')
        .reply(200, { errors: ['An error has occurred.'] });
    });

    it('should return an error', () => {
      expect(request.run('post', '/orders', {})).to.be.rejectedWith(
        'An error has occurred'
      );
    });
  });

  context('given a malformed request JSON', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com')
        .defaultReplyHeaders({ 'Content-Type': 'application/json' })
        .post('/orders')
        .reply(200, '<malformed>');
    });

    it('should return an error', () => {
      expect(request.run('post', '/orders', {})).to.be.rejectedWith(
        'Unexpected token'
      );
    });
  });

  context('if json is not returned', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com')
        .defaultReplyHeaders({ 'Content-Type': 'application/xml' })
        .post('/orders')
        .reply(200, '<xml></xml>');
      nock('https://api.bigcommerce.com')
        .defaultReplyHeaders({ 'Content-Type': 'application/json' })
        .post('/customers')
        .reply(200, '<html></html>');
    });

    it('should return the raw response', () => {
      expect(request.run('post', '/orders', {})).to.eventually.equal(
        '<xml></xml>'
      );
    });

    it('should attach the response if the JSON cannot be parsed', async () => {
      try {
        const result = await request.run('post', '/customers', {});
        console.debug(result);
        expect.fail('You shall not pass!');
      } catch (e) {
        expect(e).to.have.property('responseBody');
      }
    });
  });

  context('timeout', () => {
    beforeEach(() => {
      nock('https://api.bigcommerce.com')
        .post('/orders')
        .replyWithError('ECONNRESET');
    });

    it('should return an error', () => {
      expect(request.run('post', '/orders', {})).to.be.rejectedWith(
        'ECONNRESET'
      );
    });
  });

  it('should attach a keep-alive HTTPS agent', () => {
    nock('https://api.bigcommerce.com')
      .post('/orders')
      .reply(200, { order: true });

    const request = new Request('api.bigcommerce.com', {
      headers: { 'Content-Type': 'application/json' },
      agent: new HttpsAgent({
        maxSockets: 30,
        maxFreeSockets: 30,
        timeout: 60000,
        freeSocketTimeout: 30000,
      }),
    });

    expect(request.run('post', '/orders')).to.eventually.be.an('object');
  });

  it('should return a JSON object on success', () => {
    nock('https://api.bigcommerce.com')
      .post('/orders')
      .reply(200, { order: true });
    expect(request.run('post', '/orders'))
      .to.eventually.be.an('object')
      .and.have.property('order', true);
  });

  it('should accept and parse a GZIP JSON response', () => {
    const data = JSON.stringify({ order: true });
    const buffer = Buffer.from(data);
    const zipped = zlib.gzipSync(buffer);
    nock('https://api.bigcommerce.com')
      .post('/orders')
      .reply(200, zipped, {
        'X-Transfer-Length': String(zipped.length),
        'Content-Length': undefined,
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json',
      });

    const request = new Request('api.bigcommerce.com', {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    expect(request.run('post', '/orders')).to.eventually.have.property(
      'order',
      true
    );
  });

  it('should accept and parse a non-GZIP JSON response', () => {
    const data = JSON.stringify({ order: true });
    const buffer = Buffer.from(data);

    nock('https://api.bigcommerce.com')
      .post('/orders')
      .reply(200, buffer, {
        'X-Transfer-Length': String(buffer.length),
        'Content-Length': undefined,
        'Content-Type': 'application/json',
      });

    const request = new Request('api.bigcommerce.com', {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': '*',
      },
    });

    expect(request.run('post', '/orders')).to.eventually.have.property(
      'order',
      true
    );
  });
});
