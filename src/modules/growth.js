const fibonacci = [13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1579, 2566, 4145, 6711, 10856]

function page (current) {
  const index = fibonacci.findIndex(fib => fib > current)
  const next = fibonacci[index]
  const previous = next - current
  return {
    previous,
    next
  }
}

export default {
  first () {
    return fibonacci[0]
  },
  next (current) {
    return page(current).next
  },
  previous (current) {
    return page(current).previous
  }
}

// function* fib() {
//   var current = a = b = 1;
//
//   yield 1;
//
//   while (true) {
//     current = b;
//
//     yield current;
//
//     b = a + b;
//     a = current;
//   }
// }
//
// let sequence = fib();
// sequence.next(); // 1
// sequence.next(); // 1
// sequence.next(); // 2
