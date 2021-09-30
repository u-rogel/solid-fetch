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
    for (const [key, value] of Object.entries(config)) {
      this[key] = value
    }
  }

  // Some api servers return info in their headers
  cutHeaders (res){
    let headersObj = {};
    res.headers.forEach((val, key) => {
      headersObj[key] = val;
    });
    return headersObj;
  };

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

      const url = `${path}${Object.keys(query).length ? resolvedQuery : ''}`

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
        const interceptedResFinalVal = this.interceptedReq.reduce((accReq, interceptor) => {
          const interceptedReqVal = interceptor.action(accReq)
          return interceptedReqVal || accReq
        }, request)

        finalUrl = interceptedResFinalVal.url
        finalRequestOptions = interceptedResFinalVal.requestOptions
      }

      return this.systemFetch(finalUrl, finalRequestOptions)
        .then(async (response) => {
          if (response.status < 200 && response.status >=300) {
            // Responses 200-299 are successfull responses. 
            // more info : https://developer.mozilla.org/en-US/docs/Web/HTTP/Status

            const error = new Error(JSON.stringify({
              name: 'NoSuccess',
              message: 'request resulted in error',
              response: {
                bodyUsed: response.bodyUsed,
                headers: Object.fromEntries(response.headers.entries()),
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
          }

          if (response.headers.get('content-type').includes('application/json')) {
            result.data = await response.json()
          } else {
            result.data = response
          }

          // for those servers that returns info in the headers
          result.headers = this.cutHeaders(response)

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

// export default new SolidFetch()
// export const instance = () => new SolidFetch()

module.exports = new SolidFetch()
