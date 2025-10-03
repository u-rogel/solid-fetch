type ValueOrGetter<T> = {
  [K in keyof T]: T[K] | (() => T[K]);
};

type InjectableFuncProps<Injectables> = Injectables

type InjectableFunc<Injectables> = (p: InjectableFuncProps<Injectables>) => Exclude<InjectableValue<Injectables>, InjectableFunc<Injectables>>

type InjectableObject<Injectables> = (p: InjectableFuncProps<Injectables>) => Record<string, Exclude<InjectableValue<Injectables>, InjectableFunc<Injectables>>>

type InjectableValue<Injectables> = string | number | boolean | null | InjectableFunc<Injectables>

interface RequestCaller<Injectables> {
  query?: Record<string, InjectableValue<Injectables>> | InjectableObject<Injectables>
  method?: RequestInit['method']
  headers?: Record<string, InjectableValue<Injectables>> | InjectableObject<Injectables>
  body?: string | object | FormData | Record<string, InjectableValue<Injectables>> | InjectableValue<Injectables> | any[]
  credentials?: RequestInit['credentials']
}

type ResponseTypes = string | ArrayBuffer | any

interface Result<RequestOptions, Data extends ResponseTypes> {
  request: {
    url: string
    requestOptions: RequestOptions
  }
  headers: ResponseInit['headers']
  ok: boolean
  redirected: boolean
  status: ResponseInit['status']
  statusText: ResponseInit['statusText']
  data: Data
}

interface RequestOptions {
  method: RequestInit['method']
  headers: RequestInit['headers']
  body?: string | FormData
  credentials?: RequestInit['credentials']
}

class SolidFetch<Injectables extends Record<string, any>> {
  injectables: () => Injectables | Record<string, any>
  interceptedReq: any[]
  interceptedRes: any[]
  interceptedErr: any[]
  globalQuery: any
  globalHeaders: any
  globalCredentials?: RequestInit['credentials']

  constructor({
    initInjectables = {} as Injectables,
    interceptedReq = [],
    interceptedRes = [],
    interceptedErr = [],
    globalQuery = {},
    globalHeaders = {},
    globalCredentials,
  }: {
    initInjectables?: ValueOrGetter<Injectables>,
    interceptedReq?: any[],
    interceptedRes?: any[],
    interceptedErr?: any[],
    globalQuery?: any,
    globalHeaders?: any,
    globalCredentials?: RequestInit['credentials'],
  }) {
    this.injectables = () => initInjectables
    this.interceptedReq = interceptedReq
    this.interceptedRes = interceptedRes
    this.interceptedErr = interceptedErr
    this.globalQuery = globalQuery
    this.globalHeaders = globalHeaders
    if (globalCredentials != null) {
      this.globalCredentials = globalCredentials
    }
  }

  #emptySearch = /\?$/

  #searchWithParam = /\?.+$/

  setConfig(config: Partial<SolidFetch<Injectables>>) {
    const newConfigKeys = Object.keys(config) as Array<keyof Partial<SolidFetch<Injectables>>>
    newConfigKeys.forEach((key) => {
      this[key] = config[key]
    })
  }

  setInjectables(newInjectables: Partial<Injectables>) {
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
    }, {} as Injectables)
  }

  resolveDynamic(dynamicParams: any) {
    const injectables = this.getInjectables()
    if (Array.isArray(dynamicParams)) {
      let resolvedParams: any[] = []
      if (dynamicParams.length > 0) {
        resolvedParams = dynamicParams.map((item) => {
          if (typeof item === 'function') {
            return item(injectables)
          }
          return item
        })
      }
      return resolvedParams
    }
    const resolvedParams = Object.keys(dynamicParams).reduce((acc, key) => {
      if (typeof dynamicParams[key] === 'function') {
        return { ...acc, [key]: dynamicParams[key](injectables) }
      }
      return { ...acc, [key]: dynamicParams[key] }
    }, {})
    return resolvedParams
  }

  generateRequest(pathStructure: any, ...dynamicParams: any) {
    const resolvedParams: Record<string, string> = this.resolveDynamic(dynamicParams)
    const url = pathStructure.reduce((acc: string, hardStr: string, idx: any) => {
      const pathWithParams = `${hardStr}${resolvedParams[idx] !== undefined ? resolvedParams[idx] : ''}`
      return `${acc}${pathWithParams}`
    }, '')

    return url
  }

  request<Data extends ResponseTypes = any>(pathStructure: TemplateStringsArray, ...dynamicParams: Array<InjectableValue<Injectables>>) {
    const path: string = this.generateRequest(pathStructure, ...dynamicParams)

    return ({
      method = 'GET',
      query: rawQuery = {},
      headers: rawHeaders = {},
      body,
      credentials: rawCredentials,
    }: RequestCaller<Injectables> = {}) => {
      const query = {
        ...this.globalQuery,
        ...(() => {
          if (typeof rawQuery === 'function') {
            return rawQuery(this.getInjectables() as Injectables)
          }
          return rawQuery
        })()
      }
      const headers = {
        ...this.globalHeaders,
        ...(() => {
          if (typeof rawHeaders === 'function') {
            return rawHeaders(this.getInjectables() as Injectables)
          }
          return rawHeaders
        })()
      }
      let searchQueryPrepend = ''
      if (this.#emptySearch.test(path)) {
        searchQueryPrepend = ''
      } else if (this.#searchWithParam.test(path)) {
        searchQueryPrepend = '&'
      } else {
        searchQueryPrepend = '?'
      }

      const resolvedQuery: Record<string, string> = this.resolveDynamic(query)
      const queryStr = Object.keys(resolvedQuery).reduce((acc, queryKey: string, idx, array) => {
        const isAmpsConcat = idx + 1 < array.length
        const queryValue = `${queryKey}=${resolvedQuery[queryKey]}`
        return `${acc}${queryValue}${isAmpsConcat ? '&' : ''}`
      }, searchQueryPrepend)

      const url = `${path}${(Object.keys(query).length > 0) ? queryStr : ''}`

      const setHeaders: any = this.resolveDynamic(headers)

      const requestOptions: RequestOptions = {
        method,
        headers: {
          ...setHeaders,
        },
      };

      // resolving body if needed
      let resolvedBody = body
      if (typeof body === 'function') {
        resolvedBody = body(this.getInjectables() as Injectables)
      } else if (
        body instanceof FormData
      ) {
        // skip
      } else if (
        typeof body === 'object'
      ) {
        resolvedBody = this.resolveDynamic(body)
      }

      // append body to request
      if (
        resolvedBody instanceof FormData
      ) {
        requestOptions.body = resolvedBody
      } else if (
        typeof resolvedBody === 'object'
      ) {
        // @ts-expect-error is a valid header
        requestOptions.headers['Content-Type'] = 'application/json'
        requestOptions.body = JSON.stringify(resolvedBody)
      } else if (typeof resolvedBody === 'string') {
        requestOptions.body = resolvedBody
      }

      if (rawCredentials != null || this.globalCredentials != null) {
        if (rawCredentials != null) {
          requestOptions.credentials = rawCredentials
        } else if (this.globalCredentials != null) {
          requestOptions.credentials = this.globalCredentials
        }
      }

      let finalUrl = url
      let finalRequestOptions = { ...requestOptions }

      if (this.interceptedReq.length > 0) {
        const request = {
          url: finalUrl,
          requestOptions: finalRequestOptions,
        }

        const interceptedReqFinalVal = this.interceptedReq.reduce((accReq, interceptor) => {
          const interceptedReqVal = interceptor.action(accReq)
          return interceptedReqVal !== null ? interceptedReqVal : accReq
        }, request)

        finalUrl = interceptedReqFinalVal.url
        finalRequestOptions = interceptedReqFinalVal.requestOptions
      }

      return fetch(finalUrl, finalRequestOptions)
        .then(async (response): Promise<Result<RequestOptions, Data>> => {
          const responseHeaders = Object.fromEntries(response.headers.entries())
          if (response.status < 200 || response.status >= 300) {
            const error = new Error(JSON.stringify({
              name: 'NoSuccess',
              message: 'request resulted in error',
              response: {
                bodyUsed: response.bodyUsed,
                headers: responseHeaders,
                ok: response.ok,
                redirected: response.redirected,
                status: response.status,
                statusText: response.statusText,
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

          const result: Result<RequestOptions, Data> = {
            request: {
              url: finalUrl,
              requestOptions: finalRequestOptions,
            },
            headers: responseHeaders,
            ok: response.ok,
            redirected: response.redirected,
            status: response.status,
            statusText: response.statusText,
            data: await (async () => {
              if (responseHeaders?.['content-type']) {
                if (
                  responseHeaders['content-type'].includes('application/json')
                ) {
                  return response.json() as Data
                }
                if (
                  responseHeaders['content-type'].includes('text/plain')
                ) {
                  return response.text() as Data
                }
              }
              return response.arrayBuffer() as Data
            })()
          }

          if (this.interceptedRes.length > 0) {
            const interceptedResFinalVal = this.interceptedRes.reduce((accResult, interceptor) => {
              const interceptedResVal = interceptor.action(accResult)
              return interceptedResVal !== undefined ? interceptedResVal : accResult
            }, result)
            return interceptedResFinalVal
          }

          return result
        })
        .catch((error: any) => {
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
          if (this.interceptedErr.length > 0) {
            const interceptedErrFinalVal = this.interceptedErr.reduce((accError, interceptor) => {
              const interceptedErrVal = interceptor.action(accError)
              return interceptedErrVal !== undefined ? interceptedErrVal : accError
            }, finalError)
            throw interceptedErrFinalVal
          }
          throw finalError
        })
    }
  }
}

export default SolidFetch

