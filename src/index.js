class SolidFetch {
  constructor() {
    this.injectables = () => ({})
    this.interceptedReq = []
    this.interceptedRes = []
    this.interceptedError = []
    this.globalQuery = {}
    this.globalHeaders = {}
    this.systemFetch = null
  }

  #emptySearch = /\?$/

  #searchWithParam = /\?.+$/

  setConfig(config) {
    const newConfigKeys = Object.keys(config)
    newConfigKeys.forEach((key) => {
      this[key] = config[key]
    })
  }

  setInjectables(newInjectables) {
    const currentInjectables = this.injectables()
    this.injectables = () => ({
      ...currentInjectables,
      ...newInjectables,
    })
  }

  getInjectables() {
    const currentInjectables = this.injectables()
    return Object.keys(currentInjectables).reduce((acc, key) => {
      let value = currentInjectables[key]
      if (typeof currentInjectables[key] === 'function') {
        value = currentInjectables[key]()
      }
      return { ...acc, [key]: value }
    }, {})
  }

  resolveDynamic(withDynamicParams) {
    if (Array.isArray(withDynamicParams)) {
      let resolvedParams = []
      if (withDynamicParams && withDynamicParams.length) {
        resolvedParams = withDynamicParams.map((item) => {
          if (typeof item === 'function') {
            return item(this.getInjectables())
          }
          return item
        })
      }
      return resolvedParams
    }
    let resolvedParams = {}
    const dynamicKeys = Object.keys(withDynamicParams)
    if (dynamicKeys.length) {
      resolvedParams = dynamicKeys.map((key) => {
        if (typeof withDynamicParams[key] === 'function') {
          return withDynamicParams[key](this.getInjectables())
        }
        return withDynamicParams[key]
      })
    }

    return resolvedParams
  }

  generateRequest(pathStructure, ...dynamicParams) {
    const resolvedParams = this.resolveDynamic(dynamicParams)
    const url = pathStructure.reduce((acc, val, idx, arr) => {
      let mergedPathWithParams = `${val}`
      if (idx !== arr.length - 1 && resolvedParams[idx]) {
        mergedPathWithParams = `${mergedPathWithParams}${resolvedParams[idx]}`
      }
      return `${acc}${mergedPathWithParams}`
    }, '')

    return url
  }

  request(pathStructure, ...dynamicParams) {
    const path = this.generateRequest(pathStructure, ...dynamicParams)

    return ({
      method = 'GET',
      query: rawQuery = {},
      headers: rawHeaders = {},
      body,
    } = {}) => {
      if (!this.systemFetch) {
        throw new Error('Fetch has to be declared before the request-client can work')
      }

      const query = { ...this.globalQuery, ...rawQuery }
      const headers = { ...this.globalHeaders, ...rawHeaders }

      let searchQueryPrepend = ''
      if (this.#emptySearch.test(path)) {
        searchQueryPrepend = ''
      } else if (this.#searchWithParam.test(path)) {
        searchQueryPrepend = '&'
      } else {
        searchQueryPrepend = '?'
      }

      const resolvedQuery = Object.keys(query).reduce((acc, queryKey, idx, array) => {
        const isAnpsConcat = idx + 1 < array.length
        let queryValue = `${queryKey}=${query[queryKey]}`
        if (typeof query[queryKey] === 'function') {
          queryValue = `${queryKey}=${query[queryKey](this.getInjectables())}`
        }
        return `${acc}${queryValue}${isAnpsConcat ? '&' : ''}`
      }, searchQueryPrepend)

      const url = `${path}${resolvedQuery}`

      const setHeaders = Object.keys(headers).reduce((headerAcc, headerKey) => {
        let headerValue = headers[headerKey]
        if (typeof headers[headerKey] === 'function') {
          headerValue = headers[headerKey](this.getInjectables())
        }
        return { ...headerAcc, [headerKey]: headerValue }
      }, {})

      const requestOptions = {
        method,
        headers: {
          ...setHeaders,
        },
        body,
      }

      let finalUrl = url
      let finalRequestOptions = { ...requestOptions }

      if (this.interceptedReq.length) {
        const request = {
          url: finalUrl,
          requestOptions: finalRequestOptions,
        }
        const interceptedResFinalValue = this.interceptedReq.reduce((accResult, interceptor) => {
          const interceptedReqValue = interceptor.action(accResult)
          return interceptedReqValue
        }, request)

        if (interceptedResFinalValue) {
          finalUrl = interceptedResFinalValue.url
          finalRequestOptions = interceptedResFinalValue.requestOptions
        }
      }

      return this.systemFetch(finalUrl, finalRequestOptions)
        .then(async (response) => {
          if (response.status !== 200) {
            throw new Error(JSON.stringify({
              message: 'request resulted in error',
              error: {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                counter: response.counter,
              },
              request: {
                url: finalUrl,
                requestOptions: finalRequestOptions,
              },
            }))
          }
          let result
          if (response.headers.get('content-type').includes('application/json')) {
            result = await response.json()
          } else {
            result = response
          }
          if (this.interceptedRes.length) {
            const interceptedResValue = this.interceptedRes.reduce((accResult, interceptor) => {
              const interceptedRes = interceptor.action(accResult)
              return interceptedRes
            }, result)
            if (interceptedResValue) {
              return interceptedResValue
            }
          }
          return result
        })
        .catch((error) => {
          if (this.interceptedError.length) {
            const interceptedErrValue = this.interceptedError.reduce((accError, interceptor) => {
              const interceptedRes = interceptor.action(accError)
              return interceptedRes
            }, error)
            if (interceptedErrValue) {
              throw new Error(interceptedErrValue)
            }
          }
          throw new Error(error)
        })
    }
  }
}

export default new SolidFetch()
export const instance = () => new SolidFetch()
