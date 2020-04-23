// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
const Local = (superclass) => class extends superclass {
  save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    if (items) localStorage.setItem(this.id, items.innerHTML)
  }
}
export default Local
