// Load a polyfill only where the browser lacks the feature.

// <template for>: parse a marker and a patch; a supporting parser swaps them.
const probe = document.createElement('div')
probe.innerHTML = '<?marker name="probe"><template for="probe">ok</template>'
if (probe.textContent !== 'ok') await import('/scripts/template-for-polyfill.js')

// <template src>: nothing to try without a fetch, so ask for the property.
if (!('src' in HTMLTemplateElement.prototype)) {
  const { include } = await import('/scripts/include.js')
  await include(document)
}
