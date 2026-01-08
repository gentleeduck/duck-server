# Turbo@acme starter

This Turbo@acme starter is maintained by the Turbo@acme core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turbo@acme includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@acme/ui`: a stub React component library shared by both `web` and `docs` applications
- `@acme/biome-config`: `biome` configurations
- `@acme/typescript-config`: `tsconfig.json`s used throughout the mono@acme

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turbo@acme has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Biome](https://biomejs.dev/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turbo@acme

# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turbo@acme.com/docs/crafting-your-@acmesitory/running-tasks#using-filters):

```
# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turbo@acme

# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turbo@acme.com/docs/crafting-your-@acmesitory/running-tasks#using-filters):

```
# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turbo@acme can use a technique known as [Remote Caching](https://turbo@acme.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turbo@acme will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turbo@acme-examples), then enter the following commands:

```
cd my-turbo@acme

# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turbo@acme CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turbo@acme to your Remote Cache by running the following command from the root of your Turbo@acme:

```
# With [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turbo@acme.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turbo@acme:

- [Tasks](https://turbo@acme.com/docs/crafting-your-@acmesitory/running-tasks)
- [Caching](https://turbo@acme.com/docs/crafting-your-@acmesitory/caching)
- [Remote Caching](https://turbo@acme.com/docs/core-concepts/remote-caching)
- [Filtering](https://turbo@acme.com/docs/crafting-your-@acmesitory/running-tasks#using-filters)
- [Configuration Options](https://turbo@acme.com/docs/reference/configuration)
- [CLI Usage](https://turbo@acme.com/docs/reference/command-line-reference)
