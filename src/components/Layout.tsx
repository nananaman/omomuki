import type { FC, PropsWithChildren } from 'hono/jsx'

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({
  children,
  title = '趣 - おもむき'
}) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600&family=Shippori+Mincho:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles/global.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
