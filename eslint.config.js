import eslintConfigPrettier from 'eslint-config-prettier';

const config = [
  eslintConfigPrettier,
  {
    ignores: ['node_modules'],
  },
];

export default config;
