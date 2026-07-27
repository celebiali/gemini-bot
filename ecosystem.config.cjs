module.exports = {
  apps: [
    {
      name: 'gemini-bot',
      script: '.output/server/index.mjs',
      instances: '1',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
    },
  ],
}
