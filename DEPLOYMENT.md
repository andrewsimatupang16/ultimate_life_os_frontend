# Frontend Deployment

## Vercel

Import this frontend repository into Vercel.

Use:

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Set this Vercel environment variable:

```env
VITE_API_URL=https://your-huggingface-username-your-space-name.hf.space
```

The app reads `VITE_API_URL` in `src/api/axios.ts`.

## Backend CORS

After Vercel gives the production URL, set the backend Hugging Face Space variable:

```env
CORS_ORIGINS=https://your-frontend.vercel.app
```

Then restart the Space.
