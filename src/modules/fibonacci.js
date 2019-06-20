const sequence = [8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1579, 2566, 4145, 6711, 10856 ]

function fibonacci(number){
  const next_index = sequence.findIndex(fib => {
    return fib >= number
  })
  const next = sequence[next_index]
  const previous = sequence[next_index -1]  
  return {
    previous,
    next
  }
}

export default {
  next(number){
    return fibonacci(number).next
  },
  previous(number) {
    return fibonacci(number).previous
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
