<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="sitemap xhtml"
>
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <meta name="color-scheme" content="light dark"/>
        <title>sitemap · ege.celikci.me</title>
        <style>
          body { font-family: monospace; max-width: 60rem; margin: 3rem auto; padding: 0 1rem; background: #fef6e4; color: #1a1a1a; }
          h1 { font-size: 1rem; }
          p { color: #555; }
          a { color: inherit; }
          a:hover { color: #a60c49; }
          details { margin-block: 1.5rem; }
          summary { cursor: pointer; color: #555; }
          summary:hover { color: #a60c49; }
          table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
          th, td { text-align: left; padding: 0.375rem 0.75rem 0.375rem 0; border-bottom: 1px solid #ddd; vertical-align: top; }
          th { color: #555; font-weight: normal; }
          td:last-child { white-space: nowrap; }
          @media (prefers-color-scheme: dark) {
            body { background: #3a2a55; color: #e8e2f3; }
            p, th { color: #d0c8e8; }
            a:hover, summary:hover { color: #ff8e8c; }
            summary { color: #b8afdc; }
            th, td { border-bottom-color: #52427a; }
          }
        </style>
      </head>
      <body>
        <h1>sitemap</h1>
        <p>
          <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
          <xsl:text> pages. generated for crawlers, readable by humans. lost? return </xsl:text>
          <a href="/">home</a>.
        </p>

        <details open="open">
          <summary>
            <xsl:text>pages · </xsl:text>
            <xsl:value-of select="count(sitemap:urlset/sitemap:url[not(contains(sitemap:loc, '/notes/')) and not(contains(sitemap:loc, '/tags/')) and not(contains(sitemap:loc, '/event'))])"/>
          </summary>
          <xsl:call-template name="rows">
            <xsl:with-param
              name="nodes"
              select="sitemap:urlset/sitemap:url[not(contains(sitemap:loc, '/notes/')) and not(contains(sitemap:loc, '/tags/')) and not(contains(sitemap:loc, '/event'))]"
            />
          </xsl:call-template>
        </details>

        <details>
          <summary>
            <xsl:text>notes · </xsl:text>
            <xsl:value-of select="count(sitemap:urlset/sitemap:url[contains(sitemap:loc, '/notes/')])"/>
          </summary>
          <xsl:call-template name="rows">
            <xsl:with-param
              name="nodes"
              select="sitemap:urlset/sitemap:url[contains(sitemap:loc, '/notes/')]"
            />
          </xsl:call-template>
        </details>

        <details>
          <summary>
            <xsl:text>topics · </xsl:text>
            <xsl:value-of select="count(sitemap:urlset/sitemap:url[contains(sitemap:loc, '/tags/')])"/>
          </summary>
          <xsl:call-template name="rows">
            <xsl:with-param
              name="nodes"
              select="sitemap:urlset/sitemap:url[contains(sitemap:loc, '/tags/')]"
            />
          </xsl:call-template>
        </details>

        <details>
          <summary>
            <xsl:text>events · </xsl:text>
            <xsl:value-of select="count(sitemap:urlset/sitemap:url[contains(sitemap:loc, '/event')])"/>
          </summary>
          <xsl:call-template name="rows">
            <xsl:with-param
              name="nodes"
              select="sitemap:urlset/sitemap:url[contains(sitemap:loc, '/event')]"
            />
          </xsl:call-template>
        </details>
      </body>
    </html>
  </xsl:template>

  <xsl:template name="rows">
    <xsl:param name="nodes"/>
    <table>
      <thead>
        <tr><th>url</th><th>lastmod</th><th>lang</th></tr>
      </thead>
      <tbody>
        <xsl:for-each select="$nodes">
          <xsl:sort select="sitemap:lastmod" order="descending"/>
          <tr>
            <td>
              <a href="{sitemap:loc}">
                <xsl:value-of select="sitemap:loc"/>
              </a>
            </td>
            <td>
              <xsl:value-of select="substring(sitemap:lastmod, 1, 10)"/>
            </td>
            <td>
              <xsl:for-each select="xhtml:link">
                <a href="{@href}">
                  <xsl:value-of select="@hreflang"/>
                </a>
                <xsl:if test="position() != last()">
                  <xsl:text> </xsl:text>
                </xsl:if>
              </xsl:for-each>
            </td>
          </tr>
        </xsl:for-each>
      </tbody>
    </table>
  </xsl:template>
</xsl:stylesheet>
