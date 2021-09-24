module.exports = (property, funcResolver) => {
  let value = property
  if (typeof property === 'function') {
    value = property(funcResolver())
  }
  return value
}
