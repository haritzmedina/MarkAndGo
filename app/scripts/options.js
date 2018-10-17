// Enable chromereload by uncommenting this line:
// import 'chromereload/devonly'

console.log(`'Allo 'Allo! Options`)

const Options = require('./options/Options')

window.addEventListener('load', (event) => {
  window.options = new Options()
  window.options.init()
})
