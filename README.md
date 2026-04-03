# File Storage App with Hugging Face Buckets

This app is a simple file upload/download manager with local disk storage and optional Hugging Face Storage Bucket integration.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
export HF_BUCKET="ogama2339d/ogama2339d"        # Use your HF bucket name
export HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxx"      # Use your HF token
```

3. Run the server:

```bash
npm start
```

4. Open in browser:

`http://localhost:3000`

## Usage

- Local upload/download/delete uses `/api/upload`, `/api/files`, `/api/download/*`, `/api/delete/*`.
- HF bucket operations use `/api/hf/*` and UI controls in the web page.
- Toggle `Local` / `HF Bucket` before Upload.
- `Show HF Bucket Files` and `Refresh HF Bucket Files` are available.

## Notes

- Ensure `HF_BUCKET` and `HF_TOKEN` are set before starting the server or use the app configuration UI.
- HF bucket path is `buckets/<namespace>/<bucket-name>` in the code.
- Use `UPLOADS_DIR` to override local storage path when needed.
- Configuration saved through the app is stored in a runtime config file and used by Hugging Face routes.

## Vercel Deployment

1. Install the Vercel CLI if needed:
   ```bash
   npm install -g vercel
   ```
2. Deploy from the project root:
   ```bash
   cd /workspaces/file-storage-app
   vercel --prod
   ```
3. Configure environment variables in Vercel:
   - `HF_BUCKET`
   - `HF_TOKEN`
   - Optional: `UPLOADS_DIR=/tmp/uploads` for temporary local uploads on Vercel.
4. The app uses Vercel serverless API routes under `/api/*`.

> Note: local uploads and runtime config file storage on Vercel are ephemeral and stored in temporary function storage. Configuration saved through the app will work during the current deployment instance, but it is not guaranteed to persist across new cold starts or redeployments.
