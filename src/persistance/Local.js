// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
const Local = (superclass) => class extends superclass {
  constructor (itemid) {
    if(super) super(itemid)
  }
  as_kilobytes () {
    const bytes = localStorage.getItem(this.id)
    if (bytes) return (bytes.length / 1024).toFixed(2)
    else return 0
  }
  save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    if (!items) return
    localStorage.setItem(this.id, items.outerHTML)
  }
}
