import MisskeyAPI from './misskey/api_client'
import { DEFAULT_UA } from './default'
import { ProxyConfig } from './proxy_config'
import OAuth from './oauth'
import Response from './response'
import { NoImplementedError, ArgumentError, UnexpectedError } from './megalodon'

export default class Misskey {
  public client: MisskeyAPI.Client
  public baseUrl: string
  public proxyConfig: ProxyConfig | false

  /**
   * @param baseUrl hostname or base URL
   * @param accessToken access token from OAuth2 authorization
   * @param userAgent UserAgent is specified in header on request.
   * @param proxyConfig Proxy setting, or set false if don't use proxy.
   */
  constructor(
    baseUrl: string,
    accessToken: string | null = null,
    userAgent: string | null = DEFAULT_UA,
    proxyConfig: ProxyConfig | false = false
  ) {
    let token: string = ''
    if (accessToken) {
      token = accessToken
    }
    let agent: string = DEFAULT_UA
    if (userAgent) {
      agent = userAgent
    }
    this.client = new MisskeyAPI.Client(baseUrl, token, agent, proxyConfig)
    this.baseUrl = baseUrl
    this.proxyConfig = proxyConfig
  }

  public cancel(): void {
    return this.client.cancel()
  }

  public async registerApp(
    client_name: string,
    options: Partial<{ scopes: Array<string>; redirect_uris: string; website: string }> = {
      scopes: MisskeyAPI.DEFAULT_SCOPE,
      redirect_uris: this.baseUrl
    }
  ): Promise<OAuth.AppData> {
    return this.createApp(client_name, options).then(async appData => {
      return this.generateAuthUrlAndToken(appData.client_secret).then(session => {
        appData.url = session.url
        appData.session_token = session.token
        return appData
      })
    })
  }

  /**
   * POST /api/app/create
   *
   * Create an application.
   * @param client_name Your application's name.
   * @param options Form data.
   */
  public async createApp(
    client_name: string,
    options: Partial<{ scopes: Array<string>; redirect_uris: string; website: string }> = {
      scopes: MisskeyAPI.DEFAULT_SCOPE,
      redirect_uris: this.baseUrl
    }
  ): Promise<OAuth.AppData> {
    const redirect_uris = options.redirect_uris || this.baseUrl
    const scopes = options.scopes || MisskeyAPI.DEFAULT_SCOPE

    const params: {
      name: string
      description: string
      permission: Array<string>
      callbackUrl: string
    } = {
      name: client_name,
      description: '',
      permission: scopes,
      callbackUrl: redirect_uris
    }

    /**
     * The response is:
     {
       "id": "xxxxxxxxxx",
       "name": "string",
       "callbackUrl": "string",
       "permission": [
         "string"
       ],
       "secret": "string"
     }
    */
    return MisskeyAPI.Client.post<MisskeyAPI.Entity.App>('/api/app/create', params, this.baseUrl, this.proxyConfig).then(
      (res: Response<MisskeyAPI.Entity.App>) => {
        const appData: OAuth.AppDataFromServer = {
          id: res.data.id,
          name: res.data.name,
          website: null,
          redirect_uri: res.data.callbackUrl,
          client_id: '',
          client_secret: res.data.secret
        }
        return OAuth.AppData.from(appData)
      }
    )
  }

  /**
   * POST /api/auth/session/generate
   */
  public async generateAuthUrlAndToken(clientSecret: string): Promise<MisskeyAPI.Entity.Session> {
    return MisskeyAPI.Client.post<MisskeyAPI.Entity.Session>('/api/auth/session/generate', {
      appSecret: clientSecret
    }).then((res: Response<MisskeyAPI.Entity.Session>) => res.data)
  }

  // ======================================
  // apps
  // ======================================
  public async verifyAppCredentials(): Promise<Response<Entity.Application>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // apps/oauth
  // ======================================
  /**
   * POST /api/auth/session/userkey
   *
   * @param _client_id This parameter is not used in this method.
   * @param client_secret Application secret key which will be provided in createApp.
   * @param session_token Session token string which will be provided in generateAuthUrlAndToken.
   * @param _redirect_uri This parameter is not used in this method.
   */
  public async fetchAccessToken(
    _client_id: string,
    client_secret: string,
    session_token: string,
    _redirect_uri: string
  ): Promise<OAuth.TokenData> {
    return MisskeyAPI.Client.post<MisskeyAPI.Entity.UserKey>('/api/auth/session/userkey', {
      appSecret: client_secret,
      token: session_token
    }).then(res => {
      const token = new OAuth.TokenData(res.data.accessToken, 'misskey', '', 0, null, null)
      return token
    })
  }

  public async refreshToken(_client_id: string, _client_secret: string, _refresh_token: string): Promise<OAuth.TokenData> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async revokeToken(_client_id: string, _client_secret: string, _token: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts
  // ======================================
  public async registerAccount(
    _username: string,
    _email: string,
    _password: string,
    _agreement: boolean,
    _locale: string,
    _reason?: string | null
  ): Promise<Response<Entity.Token>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/i
   */
  public async verifyAccountCredentials(): Promise<Response<Entity.Account>> {
    return this.client.post<MisskeyAPI.Entity.UserDetail>('/api/i').then(res => {
      return Object.assign(res, {
        data: MisskeyAPI.Converter.userDetail(res.data)
      })
    })
  }

  /**
   * POST /api/i/update
   */
  public async pudateCredentials(
    _discoverable?: boolean | null,
    bot?: boolean | null,
    display_name?: string | null,
    note?: string | null,
    _avatar?: string | null,
    _header?: string | null,
    locked?: boolean | null,
    source?: {
      privacy?: string
      sensitive?: boolean
      language?: string
    } | null,
    _fields_attributes?: Array<{ name: string; value: string }>
  ): Promise<Response<Entity.Account>> {
    let params = {}
    if (bot !== null) {
      params = Object.assign(params, {
        isBot: bot
      })
    }
    if (display_name) {
      params = Object.assign(params, {
        name: display_name
      })
    }
    if (note) {
      params = Object.assign(params, {
        description: note
      })
    }
    if (locked !== null) {
      params = Object.assign(params, {
        isLocked: locked
      })
    }
    if (source) {
      if (source.language) {
        params = Object.assign(params, {
          lang: source.language
        })
      }
      if (source.sensitive) {
        params = Object.assign(params, {
          alwaysMarkNsfw: source.sensitive
        })
      }
    }

    return this.client.post<MisskeyAPI.Entity.UserDetail>('/api/i', params).then(res => {
      return Object.assign(res, {
        data: MisskeyAPI.Converter.userDetail(res.data)
      })
    })
  }

  /**
   * POST /api/users/show
   */
  public async getAccount(id: string): Promise<Response<Entity.Account>> {
    return this.client
      .post<MisskeyAPI.Entity.UserDetail>('/api/users/show', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.userDetail(res.data)
        })
      })
  }

  /**
   * POST /api/users/notes
   */
  public async getAccountStatuses(id: string): Promise<Response<Array<Entity.Status>>> {
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/users/notes', {
        userId: id
      })
      .then(res => {
        const statuses: Array<Entity.Status> = res.data.map(note => MisskeyAPI.Converter.note(note))
        return Object.assign(res, {
          data: statuses
        })
      })
  }

  public async getAccountFavourites(
    _id: string,
    _limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async subscribeAccount(_id: string): Promise<Response<Entity.Relationship>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
  public async unsubscribeAccount(_id: string): Promise<Response<Entity.Relationship>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/users/followers
   */
  public async getAccountFollowers(
    id: string,
    limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Account>>> {
    let params = {
      userId: id
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.Follower>>('/api/users/followers', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(f => MisskeyAPI.Converter.follower(f))
      })
    })
  }

  /**
   * POST /api/users/following
   */
  public async getAccountFollowing(
    id: string,
    limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Account>>> {
    let params = {
      userId: id
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.Follower>>('/api/users/following', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(f => MisskeyAPI.Converter.follower(f))
      })
    })
  }

  public async getAccountLists(_id: string): Promise<Response<Array<Entity.List>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async getIdentityProof(_id: string): Promise<Response<Array<Entity.IdentityProof>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/following/create
   */
  public async followAccount(id: string, _reblog: boolean): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/following/create', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/following/delete
   */
  public async unfollowAccount(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/following/delete', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/blocking/create
   */
  public async blockAccount(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/blocking/create', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/blocking/delete
   */
  public async unblockAccount(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/blocking/delete', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/mute/create
   */
  public async muteAccount(id: string, _notifications: boolean): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/mute/create', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/mute/delete
   */
  public async unmuteAccount(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('api/mute/delete', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  public async pinAccount(_id: string): Promise<Response<Entity.Relationship>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async unpinAccount(_id: string): Promise<Response<Entity.Relationship>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/users/relation
   *
   * @param ids Array of the accountID, for example `['1sdfag']`. Only the first element is used.
   */
  public async getRelationship(ids: Array<string>): Promise<Response<Entity.Relationship>> {
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: ids[0]
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/users/search
   */
  public async searchAccount(
    q: string,
    limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Account>>> {
    let params = {
      query: q
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.UserDetail>>('/api/users/search', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(u => MisskeyAPI.Converter.userDetail(u))
      })
    })
  }

  // ======================================
  // accounts/bookmarks
  // ======================================
  public async getBookmarks(
    _limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  //  accounts/favourites
  // ======================================
  /**
   * POST /api/i/favorites
   */
  public async getFavourites(
    limit?: number | null,
    max_id?: string | null,
    min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {}
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (min_id) {
      params = Object.assign(params, {
        sinceId: min_id
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.Favorite>>('/api/i/favorites', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(fav => MisskeyAPI.Converter.note(fav.note))
      })
    })
  }

  // ======================================
  // accounts/mutes
  // ======================================
  /**
   * POST /api/mute/list
   */
  public async getMutes(limit?: number | null, max_id?: string | null, min_id?: string | null): Promise<Response<Array<Entity.Account>>> {
    let params = {}
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (min_id) {
      params = Object.assign(params, {
        sinceId: min_id
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.Mute>>('/api/mute/list', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(mute => MisskeyAPI.Converter.userDetail(mute.mutee))
      })
    })
  }

  // ======================================
  // accounts/blocks
  // ======================================
  /**
   * POST /api/blocking/list
   */
  public async getBlocks(limit?: number | null, max_id?: string | null, min_id?: string | null): Promise<Response<Array<Entity.Account>>> {
    let params = {}
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (min_id) {
      params = Object.assign(params, {
        sinceId: min_id
      })
    }
    return this.client.post<Array<MisskeyAPI.Entity.Blocking>>('/api/blocking/list', params).then(res => {
      return Object.assign(res, {
        data: res.data.map(blocking => MisskeyAPI.Converter.userDetail(blocking.blockee))
      })
    })
  }

  // ======================================
  // accounts/domain_blocks
  // ======================================
  public async getDomainBlocks(_limit?: number | null, _max_id?: string | null, _min_id?: string | null): Promise<Response<Array<string>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async blockDomain(_domain: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async unblockDomain(_domain: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts/filters
  // ======================================
  public async getFilters(): Promise<Response<Array<Entity.Filter>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async getFilter(_id: string): Promise<Response<Entity.Filter>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async createFilter(
    _phrase: string,
    _context: Array<'home' | 'notifications' | 'public' | 'thread'>,
    _irreversible?: boolean | null,
    _whole_word?: boolean | null,
    _expires_in?: string | null
  ): Promise<Response<Entity.Filter>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async updateFilter(
    _id: string,
    _phrase: string,
    _context: Array<'home' | 'notifications' | 'public' | 'thread'>,
    _irreversible?: boolean | null,
    _whole_word?: boolean | null,
    _expires_in?: string | null
  ): Promise<Response<Entity.Filter>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async deleteFilter(_id: string): Promise<Response<Entity.Filter>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts/reports
  // ======================================
  /**
   * POST /api/users/report-abuse
   */
  public async report(
    account_id: string,
    comment: string,
    _status_ids?: Array<string> | null,
    _forward?: boolean | null
  ): Promise<Response<Entity.Report>> {
    return this.client
      .post<{}>('/api/users/report-abuse', {
        userId: account_id,
        comment: comment
      })
      .then(res => {
        return Object.assign(res, {
          data: {
            id: '',
            action_taken: '',
            comment: comment,
            account_id: account_id,
            status_ids: []
          }
        })
      })
  }

  // ======================================
  // accounts/follow_requests
  // ======================================
  /**
   * POST /api/following/requests/list
   */
  public async getFollowRequests(_limit?: number): Promise<Response<Array<Entity.Account>>> {
    return this.client.post<Array<MisskeyAPI.Entity.FollowRequest>>('/api/folllowing/requests/list').then(res => {
      return Object.assign(res, {
        data: res.data.map(r => MisskeyAPI.Converter.user(r.follower))
      })
    })
  }

  /**
   * POST /api/following/requests/accept
   */
  public async acceptFollowRequest(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('/api/following/requests/accept', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  /**
   * POST /api/following/requests/reject
   */
  public async rejectFollowRequest(id: string): Promise<Response<Entity.Relationship>> {
    await this.client.post<{}>('/api/following/requests/reject', {
      userId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Relation>('/api/users/relation', {
        userId: id
      })
      .then(res => {
        return Object.assign(res, {
          data: MisskeyAPI.Converter.relation(res.data)
        })
      })
  }

  // ======================================
  // accounts/endorsements
  // ======================================
  public async getEndorsements(
    _limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Account>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts/featured_tags
  // ======================================
  public async getFeaturedTags(): Promise<Response<Array<Entity.FeaturedTag>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
  public async createFeaturedTag(_name: string): Promise<Response<Entity.FeaturedTag>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
  public async deleteFeaturedTag(_id: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async getSuggestedTags(): Promise<Response<Array<Entity.Tag>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts/preferences
  // ======================================
  public async getPreferences(): Promise<Response<Entity.Preferences>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // accounts/suggestions
  // ======================================
  /**
   * POST /api/users/recommendation
   */
  public async getSuggestions(limit?: number): Promise<Response<Array<Entity.Account>>> {
    let params = {}
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.UserDetail>>('/api/users/recommendation', params)
      .then(res => ({ ...res, data: res.data.map(u => MisskeyAPI.Converter.userDetail(u)) }))
  }

  // ======================================
  // statuses
  // ======================================
  public async postStatus(
    status: string,
    media_ids?: Array<string>,
    poll?: { options: Array<string>; expires_in: number; multiple?: boolean; hide_totals?: boolean } | null,
    in_reply_to_id?: string | null,
    sensitive?: boolean | null,
    spoiler_text?: string | null,
    visibility?: 'public' | 'unlisted' | 'private' | 'direct' | null,
    _scheduled_at?: string | null,
    _language?: string | null
  ): Promise<Response<Entity.Status>> {
    let params = {
      text: status
    }
    if (media_ids) {
      params = Object.assign(params, {
        fileIds: media_ids
      })
    }
    if (poll) {
      let pollParam = {
        choices: poll.options,
        expiresAt: poll.expires_in
      }
      if (poll.multiple) {
        pollParam = Object.assign(pollParam, {
          multiple: poll.multiple
        })
      }
      params = Object.assign(params, {
        poll: pollParam
      })
    }
    if (in_reply_to_id) {
      params = Object.assign(params, {
        replyId: in_reply_to_id
      })
    }
    if (sensitive) {
      params = Object.assign(params, {
        cw: ''
      })
    }
    if (spoiler_text) {
      params = Object.assign(params, {
        cw: spoiler_text
      })
    }
    if (visibility) {
      params = Object.assign(params, {
        visibility: MisskeyAPI.Converter.encodeVisibility(visibility)
      })
    }
    return this.client
      .post<MisskeyAPI.Entity.CreatedNote>('/api/notes/create', params)
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data.createdNote) }))
  }

  /**
   * POST /api/notes/show
   */
  public async getStatus(id: string): Promise<Response<Entity.Status>> {
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  /**
   * POST /api/notes/delete
   */
  public async deleteStatus(id: string): Promise<Response<{}>> {
    return this.client.post<{}>('/api/notes/delete', {
      noteId: id
    })
  }

  /**
   * POST /api/notes/children
   */
  public async getStatusContext(id: string): Promise<Response<Entity.Context>> {
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/children', {
        noteId: id
      })
      .then(res => {
        const context: Entity.Context = {
          ancestors: [],
          descendants: res.data.map(n => MisskeyAPI.Converter.note(n))
        }
        return {
          ...res,
          data: context
        }
      })
  }

  /**
   * POST /api/notes/renotes
   */
  public async getStatusRebloggedBy(id: string): Promise<Response<Array<Entity.Account>>> {
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/renotes', {
        noteId: id
      })
      .then(res => ({
        ...res,
        data: res.data.map(n => MisskeyAPI.Converter.user(n.user))
      }))
  }

  public async getStatusFavouritedBy(_id: string): Promise<Response<Array<Entity.Account>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/notes/favorites/create
   */
  public async favouriteStatus(id: string): Promise<Response<Entity.Status>> {
    await this.client.post<{}>('/api/notes/favorites/create', {
      noteId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  /**
   * POST /api/notes/favorites/delete
   */
  public async unfavouriteStatus(id: string): Promise<Response<Entity.Status>> {
    await this.client.post<{}>('/api/notes/favorites/delete', {
      noteId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  /**
   * POST /api/notes/create
   */
  public async reblogStatus(id: string): Promise<Response<Entity.Status>> {
    return this.client
      .post<MisskeyAPI.Entity.CreatedNote>('/api/notes/create', {
        renoteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data.createdNote) }))
  }

  /**
   * POST /api/notes/unrenote
   */
  public async unreblogStatus(id: string): Promise<Response<Entity.Status>> {
    await this.client.post<{}>('/api/notes/unrenote', {
      noteId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  public async bookmarkStatus(_id: string): Promise<Response<Entity.Status>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async unbookmarkStatus(_id: string): Promise<Response<Entity.Status>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async muteStatus(_id: string): Promise<Response<Entity.Status>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async unmuteStatus(_id: string): Promise<Response<Entity.Status>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/i/pin
   */
  public async pinStatus(id: string): Promise<Response<Entity.Status>> {
    await this.client.post<{}>('/api/i/pin', {
      noteId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  /**
   * POST /api/i/unpin
   */
  public async unpinStatus(id: string): Promise<Response<Entity.Status>> {
    await this.client.post<{}>('/api/i/unpin', {
      noteId: id
    })
    return this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.note(res.data) }))
  }

  // ======================================
  // statuses/media
  // ======================================
  /**
   * POST /api/drive/files/create
   */
  public async uploadMedia(file: any, _description?: string | null, _focus?: string | null): Promise<Response<Entity.Attachment>> {
    const formData = new FormData()
    formData.append('file', file)
    return this.client
      .post<MisskeyAPI.Entity.File>('/api/drive/files/create', formData)
      .then(res => ({ ...res, data: MisskeyAPI.Converter.file(res.data) }))
  }

  /**
   * POST /api/drive/files/update
   */
  public async updateMedia(
    id: string,
    _file?: any,
    _description?: string | null,
    _focus?: string | null,
    is_sensitive?: boolean | null
  ): Promise<Response<Entity.Attachment>> {
    let params = {
      fileId: id
    }
    if (is_sensitive !== undefined && is_sensitive !== null) {
      params = Object.assign(params, {
        isSensitive: is_sensitive
      })
    }
    return this.client
      .post<MisskeyAPI.Entity.File>('/api/drive/files/update', params)
      .then(res => ({ ...res, data: MisskeyAPI.Converter.file(res.data) }))
  }

  // ======================================
  // statuses/polls
  // ======================================
  public async getPoll(_id: string): Promise<Response<Entity.Poll>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  /**
   * POST /api/notes/polls/vote
   */
  public async votePoll(_id: string, choices: Array<number>, status_id?: string | null): Promise<Response<Entity.Poll>> {
    if (!status_id) {
      return new Promise((_, reject) => {
        const err = new ArgumentError('status_id is required')
        reject(err)
      })
    }
    const params = {
      noteId: status_id,
      choice: choices[0]
    }
    await this.client.post<{}>('/api/notes/polls/vote', params)
    const res = await this.client
      .post<MisskeyAPI.Entity.Note>('/api/notes/show', {
        noteId: status_id
      })
      .then(res => {
        const note = MisskeyAPI.Converter.note(res.data)
        return { ...res, data: note.poll }
      })
    if (!res.data) {
      return new Promise((_, reject) => {
        const err = new UnexpectedError('poll does not exist')
        reject(err)
      })
    }
    return { ...res, data: res.data }
  }

  // ======================================
  // statuses/scheduled_statuses
  // ======================================
  public async getScheduledStatuses(
    _limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.ScheduledStatus>>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async getScheduledStatus(_id: string): Promise<Response<Entity.ScheduledStatus>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async scheduleStatus(_id: string, _scheduled_at?: string | null): Promise<Response<Entity.ScheduledStatus>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async cancelScheduledStatus(_id: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  // ======================================
  // timelines
  // ======================================
  /**
   * POST /api/notes/global-timeline
   */
  public async getPublicTimeline(
    only_media?: boolean | null,
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {}
    if (only_media) {
      params = Object.assign(params, {
        withFiles: only_media
      })
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/global-timeline', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.note(n)) }))
  }

  /**
   * POST /api/notes/local-timeline
   */
  public async getLocalTimeline(
    only_media?: boolean | null,
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {}
    if (only_media) {
      params = Object.assign(params, {
        withFiles: only_media
      })
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/local-timeline', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.note(n)) }))
  }

  /**
   * POST /api/notes/search-by-tag
   */
  public async getTagTimeline(
    hashtag: string,
    _local?: boolean | null,
    only_media?: boolean | null,
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {
      tag: hashtag
    }
    if (only_media) {
      params = Object.assign(params, {
        withFiles: only_media
      })
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/search-by-tag', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.note(n)) }))
  }

  /**
   * POST /api/notes/timeline
   */
  public async getHomeTimeline(
    _local?: boolean | null,
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {
      withFiles: false
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/timeline', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.note(n)) }))
  }

  /**
   * POST /api/notes/user-list-timeline
   */
  public async getListTimeline(
    list_id: string,
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Status>>> {
    let params = {
      listId: list_id,
      withFiles: false
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/user-list-timeline', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.note(n)) }))
  }

  // ======================================
  // timelines/conversations
  // ======================================
  /**
   * POST /api/notes/mentions
   */
  public async getConversationTimeline(
    limit?: number | null,
    max_id?: string | null,
    since_id?: string | null,
    _min_id?: string | null
  ): Promise<Response<Array<Entity.Conversation>>> {
    let params = {
      visibility: 'specified'
    }
    if (limit) {
      params = Object.assign(params, {
        limit: limit
      })
    }
    if (max_id) {
      params = Object.assign(params, {
        untilId: max_id
      })
    }
    if (since_id) {
      params = Object.assign(params, {
        sinceId: since_id
      })
    }
    return this.client
      .post<Array<MisskeyAPI.Entity.Note>>('/api/notes/mentions', params)
      .then(res => ({ ...res, data: res.data.map(n => MisskeyAPI.Converter.noteToConversation(n)) }))
  }

  public async deleteConversation(_id: string): Promise<Response<{}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
  public async readConversation(_id: string): Promise<Response<Entity.Conversation>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
  // ======================================
  // timelines/lists
  // ======================================
  /**
   * POST /api/users/lists/list
   */
  public async getLists(): Promise<Response<Array<Entity.List>>> {
    return this.client
      .post<Array<MisskeyAPI.Entity.List>>('/api/users/lists/list')
      .then(res => ({ ...res, data: res.data.map(l => MisskeyAPI.Converter.list(l)) }))
  }

  /**
   * POST /api/users/lists/show
   */
  public async getList(id: string): Promise<Response<Entity.List>> {
    return this.client
      .post<MisskeyAPI.Entity.List>('/api/users/lists/show', {
        listId: id
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.list(res.data) }))
  }

  /**
   * POST /api/users/lists/create
   */
  public async createList(title: string): Promise<Response<Entity.List>> {
    return this.client
      .post<MisskeyAPI.Entity.List>('/api/users/lists/create', {
        name: title
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.list(res.data) }))
  }

  /**
   * POST /api/users/lists/update
   */
  public async updateList(id: string, title: string): Promise<Response<Entity.List>> {
    return this.client
      .post<MisskeyAPI.Entity.List>('/api/users/lists/update', {
        listId: id,
        name: title
      })
      .then(res => ({ ...res, data: MisskeyAPI.Converter.list(res.data) }))
  }

  /**
   * POST /api/users/lists/delete
   */
  public async deleteList(id: string): Promise<Response<{}>> {
    return this.client.post<{}>('/api/users/lists/delete', {
      listId: id
    })
  }

  /**
   * POST /api/users/lists/show
   */
  public async getAccountsInList(
    id: string,
    _limit?: number | null,
    _max_id?: string | null,
    _since_id?: string | null
  ): Promise<Response<Array<Entity.Account>>> {
    const res = await this.client.post<MisskeyAPI.Entity.List>('/api/users/lists/show', {
      listId: id
    })
    const promise = res.data.userIds.map(userId => this.getAccount(userId))
    const accounts = await Promise.all(promise)
    return { ...res, data: accounts.map(r => r.data) }
  }

  /**
   * POST /api/users/lists/push
   */
  public async addAccountsToList(id: string, account_ids: Array<string>): Promise<Response<{}>> {
    return await this.client.post<{}>('/api/users/lists/push', {
      listId: id,
      userId: account_ids[0]
    })
  }

  /**
   * POST /api/users/lists/pull
   */
  public async deleteAccountsFromList(id: string, account_ids: Array<string>): Promise<Response<{}>> {
    return await this.client.post<{}>('/api/users/lists/pull', {
      listId: id,
      userId: account_ids[0]
    })
  }

  // ======================================
  // timelines/markers
  // ======================================
  public async getMarker(_timeline: Array<'home' | 'notifications'>): Promise<Response<Entity.Marker | {}>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }

  public async saveMarker(
    _home?: { last_read_id: string } | null,
    _notifications?: { last_read_id: string } | null
  ): Promise<Response<Entity.Marker>> {
    return new Promise((_, reject) => {
      const err = new NoImplementedError('misskey does not support')
      reject(err)
    })
  }
}
