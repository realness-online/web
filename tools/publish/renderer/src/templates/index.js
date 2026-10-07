export const index_body = (poster, plans, articles) => {
  const index_entry = (article) => {
    const cover = poster(article, article.title, 'h2', `/blog/${article.slug}`)
    if (plans) return `<article itemscope itemtype="http://schema.org/BlogPosting">
      ${cover}
      <template>${article.html}</template>
    </article>`
    return `<article itemscope itemtype="http://schema.org/BlogPosting">
      <details>
        <summary>${cover}</summary>
        <section itemprop="articleBody">${article.html}${article.notes || ''}</section>
      </details>
    </article>`
  }

  return `<section>${articles.map(index_entry).join('\n')}</section>`
}
