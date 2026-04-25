# span

A Next.js + TypeScript Arc App Kit dashboard for Web3 swapping, bridging, and transfers.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Setup

### Local Development

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Add your values to `.env.local`:
   - `PRIVATE_KEY` - Your EVM wallet private key (optional, for server-side fallback)
   - `NEXT_PUBLIC_APP_KIT_KEY` - Public App Kit key for browser quotes
   - `APP_KIT_KEY` - Server-side App Kit key for swap quotes

### Vercel Deployment

1. **Push to GitHub**:
   ```bash
   git add -A
   git commit -m "feat: production ready"
   git push -u origin dev
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click \"Add New...\" ? \"Project\"
   - Import your GitHub repository

3. **Configure Environment Variables**:
   In Vercel project settings, add these variables:
   - `PRIVATE_KEY` (optional, for server-side fallback)
   - `APP_KIT_KEY` (for server-side swap quotes)
   - `NEXT_PUBLIC_APP_KIT_KEY` (for browser quotes)

4. **Deploy**:
   - Click \"Deploy\" and wait for the build to complete
   - Your app will be live at `https://your-project.vercel.app`

## Features

- **Browser Wallet Connect** - MetaMask/EIP-1193 provider integration
- **Server-side Fallback** - Private key adapter when no browser wallet
- **Live Token Selection** - Dropdowns for chains and tokens
- **Swap Quote Preview** - Get swap estimates before executing
- **Action History** - Recent transactions stored in local storage

## Project Structure

```
span/
+-- app/
¦   +-- page.tsx           # Main UI with wallet connect & actions
¦   +-- layout.tsx         # Next.js layout
¦   +-- globals.css        # Dark theme styling
¦   +-- api/
¦       +-- bridge/        # Bridge endpoint
¦       +-- transfer/      # Transfer endpoint
¦       +-- swap/          # Swap endpoint
¦       +-- quote-swap/    # Swap quote endpoint
+-- lib/
¦   +-- appKit.ts          # App Kit initialization
+-- next.config.js         # Next.js configuration
+-- package.json           # Dependencies
+-- tsconfig.json          # TypeScript config
```

## Supported Chains

- Ethereum Sepolia (testnet)
- Arc Testnet
- Polygon Mumbai (testnet)
- Optimism Goerli (testnet)

## Supported Tokens

- USDC
- USDT
- NATIVE (chain native token)
- DAI
- ETH

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge` | POST | Bridge tokens across chains |
| `/api/transfer` | POST | Transfer tokens to address |
| `/api/swap` | POST | Swap tokens on same chain |
| `/api/quote-swap` | POST | Get swap quote estimate |

## Security Notes

- Never commit `.env.local` or private keys to version control
- Use Vercel environment variables for production secrets
- The `PRIVATE_KEY` is only used server-side and never exposed to clients
- App Kit keys can be obtained from [Circle Console](https://console.circle.com/)

## Documentation

- Arc App Kit Docs: https://docs.arc.network/app-kit
- Circle Console: https://console.circle.com/
- Vercel Deployment: https://vercel.com/docs/deployments/overview

