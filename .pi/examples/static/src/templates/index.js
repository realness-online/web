import { escape_html } from '../text.js'

export const index_body = (poster, plans, articles) => {
  const index_entry = (article) => {
    const cover = poster(article, article.title, 'h2', `/blog/${article.slug}`)
    const identity = article.itemid ? ` itemid="${escape_html(article.itemid)}"` : ''
    if (plans) return `<article${identity} itemscope itemtype="http://schema.org/BlogPosting">
      ${cover}
      <template>${article.html}</template>
    </article>`
    return `<article${identity} itemscope itemtype="http://schema.org/BlogPosting">
      <details>
        <summary>${cover}</summary>
        <section itemprop="articleBody">${article.html}${article.notes || ''}</section>
      </details>
    </article>`
  }

  return `<section>${articles.map(index_entry).join('\n')}</section>`
}
