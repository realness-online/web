import path from 'path'
import { readdirSync, statSync, readFileSync, unlinkSync } from 'fs'
const icons = '/Users/scott/Desktop/Icons'
import { optimize_sync } from './workers/optimize.js'
function flatten(lists) {
  return lists.reduce((a, b) => a.concat(b), [])
}

function directories(src_path) {
  return readdirSync(src_path)
    .map(file => path.join(src_path, file))
    .filter(path => statSync(path).isDirectory())
}

function optimize_files(directories = []) {
  let all_files = []
  directories.forEach(src_path => {
    const add_files = readdirSync(src_path)
      .map(file => path.join(src_path, file))
      .filter(path => !statSync(path).isDirectory())
    all_files = [...all_files, ...add_files]
  })
  return all_files
}

const search_tree = directories(icons)
// console.log('\n', search_tree, '\n')

const regex_files = optimize_files(search_tree)
// console.log('\n', regex_files, '\n')

const delete_me = []
const fix_me = []

regex_files.forEach(file_path => {
  const text = readFileSync(file_path, 'utf8')
  // console.log(text);
  const result = text.match(/itemprop="path"/gi)

  if (result && result.length > 3) {
    console.log('fix_me', file_path)
    fix_me.push(file_path)
  } else delete_me.push(file_path)
})
console.log('\n', delete_me, '\n')
delete_me.forEach(name => unlinkSync(name))
