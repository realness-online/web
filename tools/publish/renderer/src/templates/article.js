export const article_body = (poster, data, title, html, notes) => {
    return `<article itemscope itemtype="http://schema.org/BlogPosting">
      ${poster(data, title, 'h1', null, { close_href: '/' })}
      <section itemprop="articleBody">${html}${notes}</section>
    </article>`
  }
