class SolidFetch {
  constructor() {
    this.injectables = () => ({})
    this.interceptedReq = []
    this.interceptedRes = []
    this.interceptedErr = []
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
      if (typeof currentInjectables[key] === 'function') {
        return { ...acc, [key]: currentInjectables[key]() }
      }
      return { ...acc, [key]: currentInjectables[key] }
    }, {})
  }

  resolveDynamic(withDynamicParams) {
    const injectables = this.getInjectables()
    if (Array.isArray(withDynamicParams)) {
      let resolvedParams = []
      if (withDynamicParams.length) {
        resolvedParams = withDynamicParams.map((item) => {
          if (typeof item === 'function') {
            return item(injectables)
          }
          return item
        })
      }
      return resolvedParams
    }
    const resolvedParams = Object.keys(withDynamicParams).reduce((acc, key) => {
      if (typeof withDynamicParams[key] === 'function') {
        return { ...acc, [key]: withDynamicParams[key](injectables) }
      }
      return { ...acc, [key]: withDynamicParams[key] }
    }, {})
    return resolvedParams
  }

  generateRequest(pathStructure, ...dynamicParams) {
    const resolvedParams = this.resolveDynamic(dynamicParams)
    const url = pathStructure.reduce((acc, hardStr, idx) => {
      const pathWithParams = `${hardStr}${resolvedParams[idx] || ''}`
      return `${acc}${pathWithParams}`
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

      const resolvedQuery = this.resolveDynamic(query)
      const queryStr = Object.keys(resolvedQuery).reduce((acc, queryKey, idx, array) => {
        const isAnpsConcat = idx + 1 < array.length
        const queryValue = `${queryKey}=${query[queryKey]}`
        return `${acc}${queryValue}${isAnpsConcat ? '&' : ''}`
      }, searchQueryPrepend)

      const url = `${path}${Object.keys(query).length ? queryStr : ''}`

      const setHeaders = this.resolveDynamic(headers)

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
        const interceptedReqFinalVal = this.interceptedReq.reduce((accReq, interceptor) => {
          const interceptedReqVal = interceptor.action(accReq)
          return interceptedReqVal || accReq
        }, request)

        finalUrl = interceptedReqFinalVal.url
        finalRequestOptions = interceptedReqFinalVal.requestOptions
      }

      return this.systemFetch(finalUrl, finalRequestOptions)
        .then(async (response) => {
          const responseHeaders = Object.fromEntries(response.headers.entries())
          if (response.status < 200 && response.status >= 300) {
            const error = new Error(JSON.stringify({
              name: 'NoSuccess',
              message: 'request resulted in error',
              response: {
                bodyUsed: response.bodyUsed,
                headers: responseHeaders,
                ok: response.ok,
                redirected: response.redirected,
                size: response.size,
                status: response.status,
                statusText: response.statusText,
                timeout: response.timeout,
                url: response.url,
              },
              request: {
                url: finalUrl,
                requestOptions: finalRequestOptions,
              },
            }))
            error.name = 'NoSuccess'
            throw error
          }

          const result = {
            request: {
              url: finalUrl,
              requestOptions: finalRequestOptions,
            },
            data: null,
            headers: responseHeaders,
            ok: response.ok,
            redirected: response.redirected,
            size: response.size,
            status: response.status,
            statusText: response.statusText,
          }

          if (responseHeaders['content-type'].includes('application/json')) {
            result.data = await response.json()
          } else {
            result.data = response
          }

          if (this.interceptedRes.length) {
            const interceptedResFinalVal = this.interceptedRes.reduce((accResult, interceptor) => {
              const interceptedResVal = interceptor.action(accResult)
              return interceptedResVal || accResult
            }, result)
            return interceptedResFinalVal
          }

          return result
        })
        .catch((error) => {
          let finalError = error
          if (error.name !== 'NoSuccess') {
            finalError = new Error(JSON.stringify({
              name: error.name,
              message: error.message,
              request: {
                url: finalUrl,
                requestOptions: finalRequestOptions,
              },
            }))
            finalError.name = error.name
          }
          if (this.interceptedErr.length) {
            const interceptedErrFinalVal = this.interceptedErr.reduce((accError, interceptor) => {
              const interceptedErrVal = interceptor.action(accError)
              return interceptedErrVal || accError
            }, finalError)
            throw interceptedErrFinalVal
          }
          throw finalError
        })
    }
  }
}

export default new SolidFetch()
export const instance = () => new SolidFetch()
