'use strict';

import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import BigCommerce from '../lib/bigcommerce.js';
import Request from '../lib/request.js';

chai.use(chaiAsPromised);

const sandbox = sinon.createSandbox();

describe('BigCommerce', () => {
  const self = {};

  const bc = new BigCommerce({
    secret: '123456abcdef',
    clientId: '123456abcdef',
    callback: 'http://foo.com',
    accessToken: '123456',
    storeHash: '12abc',
  });

  // beforeEach(() => (sandbox = sinon.createSandbox()));
  afterEach(() => sandbox.restore());

  describe('#constructor', () => {
    it('should return an error if config is missing', () => {
      /* eslint no-new: off */
      expect(() => {
        new BigCommerce();
      }).to.throw(Error);
    });

    it('should save config to the object', () => {
      const newBc = new BigCommerce({ test: true });
      expect(newBc.config).to.be.a('object');
      expect(newBc.apiVersion).to.equal('v2');
    });

    it('should set api version to a default', () => {
      const newBc = new BigCommerce({ apiVersion: 'v3' });
      expect(newBc.apiVersion).to.equal('v3');
    });
  });

  describe('#verify', () => {
    context('given a null signed request', () => {
      it('should throw', () => {
        expect(() => bc.verify()).to.throw('signed request is required');
      });
    });

    context('given a signed request without a full stop', () => {
      it('should throw', () => {
        expect(() => bc.verify('12345')).to.throw('full stop');
      });
    });

    context('given an invalid signature', () => {
      it('should throw', () => {
        expect(() =>
          bc.verify(
            'eyJmb28iOiJmb28ifQ==.YjMzMTQ2ZGU4ZTUzNWJiOTI3NTI1ODJmNzhiZGM5NzBjNGQ3MjZkZDdkMDY1MjdkZGYxZDA0NGZjNDVjYmNkMQ=='
          )
        ).to.throw('invalid');
      });
    });

    context('given an invalid signature (different length)', () => {
      it('should throw', () => {
        expect(() => bc.verify('eyJmb28iOiJmb28ifQ==.Zm9v')).to.throw(
          'invalid'
        );
      });
    });

    it('should return the JSON data', () => {
      const verify = bc.verify(
        'eyJmb28iOiJmb28ifQ==.YjMzMTQ2ZGU4ZTUzNWJiOTI3NTI1ODJmNzhiZGM' +
          '5NzBjNGQ3MjZkZDdkMDY1MjdkZGYxZDA0NGZjNDVjYmNkMA=='
      );
      expect(verify.foo).to.equal('foo');
    });
  });

  describe('#authorize', () => {
    beforeEach(() => {
      sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ test: true }));
    });

    const query = { code: '', scope: '', context: '' };

    it('should return an object', () => {
      return expect(bc.authorize(query)).to.eventually.not.be.null;
    });

    context('when the query params are missing', () => {
      it('should return an error', () => {
        return expect(bc.authorize(null)).to.be.rejectedWith('are required');
      });
    });

    context('when the authorization fails', () => {
      beforeEach(() => {
        sandbox.restore();
        sandbox
          .stub(Request.prototype, 'run')
          .returns(Promise.reject(new Error('foo')));
      });

      it('should return and error', () => {
        return expect(bc.authorize(query)).to.be.rejectedWith('foo');
      });
    });
  });

  describe('#createAPIRequest', () => {
    it('should create a request object with the correct headers', () => {
      const request = bc.createAPIRequest();
      expect(request.headers['X-Auth-Client']).to.equal('123456abcdef');
      expect(request.headers['X-Auth-Token']).to.equal('123456');
    });

    it('should have the correct API hostname', () => {
      const request = bc.createAPIRequest();
      expect(request.hostname).to.equal('api.bigcommerce.com');
    });
  });

  describe('#request', () => {
    beforeEach(() => {
      sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ text: '' }));
    });

    it('should make a call to the request object', () => {
      expect(bc.request('get', '/foo')).to.eventually.be.fulfilled;
      expect(sandbox.assert.calledOnce(Request.prototype.run));
    });

    it('should use v3 if specified in config', () => {
      const bcV3 = new BigCommerce({
        secret: '123456abcdef',
        clientId: '123456abcdef',
        callback: 'http://foo.com',
        accessToken: '123456',
        storeHash: '12abc',
        apiVersion: 'v3',
      });
      expect(bcV3.request('get', '/themes')).to.eventually.be.fulfilled;
      expect(
        sandbox.assert.calledWith(
          Request.prototype.run,
          'get',
          '/stores/12abc/v3/themes'
        )
      );
    });

    context('when the header requirements are not met', () => {
      it('should return an error', () => {
        const bc = new BigCommerce({});
        expect(bc.request('get', '/foo')).to.eventually.be.rejectedWith(
          'access token'
        );
      });
    });

    context('when the response type is xml', () => {
      const xmlBc = new BigCommerce({
        accessToken: '123456',
        clientId: 'abcdef',
        storeHash: 'abcd/1',
        responseType: 'xml',
      });

      it('should call the request object with extension .xml', () => {
        expect(xmlBc.request('get', '/foo')).to.eventually.be.fulfilled;
        expect(
          sandbox.assert.calledWith(
            Request.prototype.run,
            'get',
            '/stores/abcd/1/v2/foo.xml'
          )
        );
      });
    });

    context('when the response type is json', () => {
      it('should make a call to the request object with an empty extension', () => {
        const jsonBc = new BigCommerce({
          accessToken: '123456',
          clientId: 'abcdef',
          storeHash: 'abcd/1',
          responseType: 'json',
        });
        expect(jsonBc.request('get', '/foo')).to.eventually.be.fulfilled;
        expect(
          sandbox.assert.calledWith(
            Request.prototype.run,
            'get',
            '/stores/abcd/1/v2/foo'
          )
        );
      });
    });
  });

  describe('#get', () => {
    beforeEach(() => {
      sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ text: '' }));
    });

    it('should make a request with the correct arguments', () => {
      expect(bc.get('/foo')).to.eventually.be.fulfilled;
      expect(
        sandbox.assert.calledWith(
          Request.prototype.run,
          'get',
          '/stores/12abc/v2/foo',
          undefined
        )
      );
    });
  });

  describe('#post', () => {
    beforeEach(() => {
      self.requestStub = sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ text: '' }));
    });

    it('should make a request with the correct arguments', () => {
      expect(bc.post('/foo', { foo: 'bar' })).to.eventually.deep.equal({
        text: '',
      });
      expect(
        sandbox.assert.calledWith(
          Request.prototype.run,
          'post',
          '/stores/12abc/v2/foo',
          { foo: 'bar' }
        )
      );
    });
  });

  describe('#put', () => {
    beforeEach(() => {
      sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ text: '' }));
    });

    it('should make a request with the correct arguments', () => {
      expect(bc.put('/foo', { foo: 'bar' })).to.eventually.deep.equal({
        text: '',
      });
      expect(
        sandbox.assert.calledWith(
          Request.prototype.run,
          'put',
          '/stores/12abc/v2/foo',
          { foo: 'bar' }
        )
      );
    });
  });

  describe('#delete', () => {
    beforeEach(() => {
      sandbox
        .stub(Request.prototype, 'run')
        .returns(Promise.resolve({ text: '' }));
    });

    it('should make a request with the correct arguments', () => {
      expect(bc.delete('/foo')).to.eventually.deep.equal({
        text: '',
      });
      expect(
        sandbox.assert.calledWith(
          Request.prototype.run,
          'delete',
          '/stores/12abc/v2/foo',
          undefined
        )
      );
    });
  });
});
