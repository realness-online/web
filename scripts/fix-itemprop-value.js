import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const update_path_attributes = file_path => {
  try {
    // Read the file content
    const content = readFileSync(file_path, 'utf8')

    // Replace first three occurrences with different values
    const modified_content = content.replace(
      /itemprop="path"/g,
      (match, offset, string) => {
        const previous_matches = string
          .slice(0, offset)
          .match(/itemprop="path"/g)
        const match_index = previous_matches ? previous_matches.length : 0

        switch (match_index) {
          case 0:
            return 'itemprop="light"'
          case 1:
            return 'itemprop="regular"'
          case 2:
            return 'itemprop="bold"'
          default:
            return match
        }
      }
    )

    // Only write if there was a change
    if (modified_content !== content) {
      writeFileSync(file_path, modified_content, 'utf8')
      console.log(`Successfully updated ${file_path}`)
    } else console.log(`No matching patterns found in ${file_path}`)
  } catch (error) {
    console.error(`Error processing ${file_path}: ${error.message}`)
  }
}

const process_directory = directory_path => {
  try {
    // Get all files in directory
    const files = readdirSync(directory_path)

    // Process each file
    files.forEach(file => {
      const full_path = join(directory_path, file)
      const stats = statSync(full_path)

      if (stats.isDirectory())
        // Recursively process subdirectories
        process_directory(full_path)
      else if (extname(file) === '.html')
        // Only process HTML files
        update_path_attributes(full_path)
    })
  } catch (error) {
    console.error(
      `Error processing directory ${directory_path}: ${error.message}`
    )
  }
}

// Example usage:
const target_directory = 'storage/people'
process_directory(target_directory)
