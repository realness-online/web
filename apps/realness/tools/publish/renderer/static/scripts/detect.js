
const probe = document.createElement('div')
probe.innerHTML = '<?marker name="probe"><template for="probe">ok</template>'
if (probe.textContent !== 'ok') await import('/scripts/template-for-polyfill.js')

if (!('src' in HTMLTemplateElement.prototype)) {
  const { include } = await import('./include.js')
  await include(document)
}
