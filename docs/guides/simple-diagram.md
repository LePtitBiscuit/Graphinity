# Create a simple diagram

The smallest useful diagram: one universe with a few nodes.

## 1. Create the file

Make a folder for your project and create `architecture.yml` in it:

```yaml [architecture.yml]
id: blog
name: My blog
nodes:
  - id: site
    name: Website
    icon: astro
    description: static site
  - id: cms
    name: CMS
    icon: strapi
    description: content
  - id: host
    name: Hosting
    icon: netlify
```

Three nodes, each with an `id` (unique in the file), a `name` and an `icon`.

## 2. Validate it

```sh
npx graphinity validate architecture.yml
```

```
✓ Valid: 1 universe, 3 nodes, 0 connections
```

## 3. Look at it

```sh
npx graphinity dev architecture.yml
```

The nodes are placed automatically, side by side. Click one to see its details.

## 4. Describe it better

Add descriptions, [tags](/config/tags) - a price, a version - and change the reading
[direction](/concepts/layout#direction):

```yaml [architecture.yml]
id: blog
name: My blog
direction: down
nodes:
  - id: site
    name: Website
    icon: astro
    description: static site
    tags: [v5]
  - id: cms
    name: CMS
    icon: strapi
    description: content
  - id: host
    name: Hosting
    icon: netlify
    tags: [free tier]
```

The open page updates as soon as you save. Next: [add connections](/guides/connections).
