import { format_date, escape_html } from '../text.js'

/**
 * @param {import('../types.js').Site} site
 * @param {Object<string, import('../types.js').PosterSize>} poster_sizes
 * @param {import('../types.js').PosterMetadata} data
 * @param {string} title
 * @param {'h1'|'h2'} [heading]
 * @param {string|null} [href]
 * @param {{close_href?: string}} [options]
 */
export const poster = (
  site,
  poster_sizes,
  data,
  title,
  heading = 'h2',
  href = null,
  options = {}
) => {
  const size = data.img ? poster_sizes[data.img] : undefined
  const ratio = size ? (size.width / size.height).toFixed(4) : null
  const focus = data.focus ? `; --focus: ${data.focus}` : ''
  const figure_style = ratio
    ? ` style="${escape_html(`--ratio: ${ratio}${focus}`)}"`
    : ''
  const img_attrs = size ? ` width="${size.width}" height="${size.height}"` : ''
  const headline = href
    ? `<a itemprop="url" href="${escape_html(href)}">${escape_html(title)}</a>`
    : escape_html(title)
  const close = options.close_href
    ? `<a class="back-link" href="${escape_html(options.close_href)}" aria-label="${escape_html(site.back_label || 'Back to articles')}">x</a>`
    : ''
  return `<figure${figure_style}>
        ${data.img ? `<img src="/posters/${escape_html(data.img)}"${img_attrs} alt="" loading="lazy">` : ''}
        <figcaption>
          <${heading} itemprop="headline">${headline}${data.draft ? ' <mark class="draft">draft</mark>' : ''}</${heading}>
          ${data.date ? `<time itemprop="datePublished" datetime="${escape_html(data.date)}">${escape_html(format_date(data.date))}</time>` : ''}
          ${close}
        </figcaption>
      </figure>`
}
