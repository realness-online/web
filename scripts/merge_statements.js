import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Get __dirname equivalent in ES modules
const __dirname = dirname(fileURLToPath(import.meta.url))

const merge_statements = html_files => {
  // Create virtual DOM for Node environment
  const dom = new JSDOM()
  const { document } = dom.window

  // Create container section
  const merged_section = document.createElement('section')
  merged_section.className = 'as-days'
  merged_section.setAttribute('itemscope', '')
  merged_section.setAttribute('itemid', '/+16282281824/statements')

  // Parse each HTML file and extract statements
  const all_statements = []
  html_files.forEach(file => {
    const doc = new JSDOM(file).window.document
    const statements = doc.querySelectorAll('[itemprop="statements"]')
    statements.forEach(statement => {
      const itemid = statement.getAttribute('itemid')
      const timestamp = parseInt(itemid.split('/').pop())
      const date = new Date(timestamp)

      all_statements.push({
        element: statement,
        timestamp,
        date_string: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        }),
        time_string: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        })
      })
    })
  })

  // Sort statements newest to oldest
  all_statements.sort((a, b) => b.timestamp - a.timestamp)

  // Group by date
  const by_date = {}
  all_statements.forEach(statement => {
    if (!by_date[statement.date_string])
      by_date[statement.date_string] = {
        date: statement.date_string,
        thoughts: {}
      }

    if (!by_date[statement.date_string].thoughts[statement.time_string])
      by_date[statement.date_string].thoughts[statement.time_string] = []

    by_date[statement.date_string].thoughts[statement.time_string].push(
      statement.element
    )
  })

  // Build merged HTML structure
  Object.values(by_date).forEach(day => {
    const day_article = document.createElement('article')
    day_article.className = 'day'

    const day_header = document.createElement('header')
    day_header.innerHTML = `<h4>${day.date}</h4>`
    day_article.appendChild(day_header)

    Object.entries(day.thoughts).forEach(([time, statements]) => {
      const thought = document.createElement('article')
      thought.className = 'thought'

      const thought_header = document.createElement('header')
      thought_header.innerHTML = `<time>${time}</time>`
      thought.appendChild(thought_header)

      statements.forEach(statement => {
        thought.appendChild(statement.cloneNode(true))
      })

      day_article.appendChild(thought)
    })

    merged_section.appendChild(day_article)
  })

  return merged_section.outerHTML
}

// Main execution
async function main() {
  const statements_dir = join(__dirname, '../storage/people/+16282281824/statements')

  try {
    // Read all HTML files in the statements directory
    const files = await fs.readdir(statements_dir)
    const html_files = await Promise.all(
      files
        .filter(file => file.endsWith('.html'))
        .map(file => fs.readFile(join(statements_dir, file), 'utf8'))
    )

    const merged = merge_statements(html_files)

    // Write merged content to index.html
    await fs.writeFile(join(statements_dir, 'index.html'), merged)

    console.log('Successfully merged statements into index.html')
  } catch (error) {
    console.error('Error merging statements:', error)
  }
}

main()
