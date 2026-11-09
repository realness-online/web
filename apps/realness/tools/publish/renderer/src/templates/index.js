import { escape_html } from '../text.js'

export const index_body = (poster, plans, articles, areas = {}) => {
  const area_of = article => (plans ? areas[article.slug] : '') ?? ''
  const index_entry = article => {
    const area = area_of(article)
    const cover = poster(article, article.title, 'h2', `/blog/${article.slug}`)
    const identity = article.itemid
      ? ` itemid="${escape_html(article.itemid)}"`
      : ''
    const grouping = area ? ` data-area="${escape_html(area)}"` : ''
    if (plans)
      return `<article${identity}${grouping} itemscope itemtype="http://schema.org/BlogPosting">
      ${cover}
      ${area ? `<span itemprop="genre">${escape_html(area)}</span>` : ''}
      <template>${article.html}</template>
    </article>`
    return `<article${identity} itemscope itemtype="http://schema.org/BlogPosting">
      <details>
        <summary>${cover}</summary>
        <section itemprop="articleBody">${article.html}${article.notes || ''}</section>
      </details>
    </article>`
  }

  const names = [...new Set(articles.map(area_of).filter(Boolean))].sort()
  const filter = plans
    ? `<nav aria-label="Plans by area"><button type="button" data-area="" aria-pressed="true">All</button>${names
        .map(
          name =>
            `<button type="button" data-area="${escape_html(name)}" aria-pressed="false">${escape_html(name)}</button>`
        )
        .join('')}</nav>`
    : ''
  return `${filter}<section>${articles.map(index_entry).join('\n')}</section>`
}
