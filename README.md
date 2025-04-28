# web-starter

This is a starter project for a SPA webapp with an API 

## Stack details

- React for frontend
- Express for backend API
- TypeScript throughout
- Vite for bundling and dev server (including HMR)
- Vitest for testing
- CLI support with yargs

## Development

```
npm install
npm run dev     # Starts dev server with hot reload
npm run cli     # Run CLI commands
npm run test    # Run tests
npm run check   # TypeScript checks
npm run format  # Format code with prettier
```

## Deploy with Render 

Create a project and connect the Github repo on [Render](https://render.com/)

## Deploy with Railway

Create a project and service in [Railway](https://railway.com/) and link it to this project.
```
railway link
npm run deploy 
```

Alternately, link the service to the Github repo for `main` to be automatically deployed.