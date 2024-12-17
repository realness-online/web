function Point(x, y) {
  this.x = x || 0
  this.y = y || 0
}

Point.prototype = {
  copy: function () {
    return new Point(this.x, this.y)
  }
}

export default Point
