/* global describe, it */
const {baseUrl} = module.context
const request = require('@arangodb/request')
const assert = require('assert')

describe('science', function () {
  it('works', function () {
    assert.notEqual(true, false)
  })
})

describe('provenance-based object viewing permissions', function () {
  // This is a large integration test that walks through a tricky authentication case
  // The `updatedTo` edge gives view permissions on objects
  // user1 and user2
  // user1 creates workspace1 with object1 (all private)
  // user1 copies it to workspace2 (which now contains object1)
  // user1 updates object1 to object2 and removes object1 from workspace2
  // user1 gives user2 view permissions on workspace2
  // when user2 lists all objects, both object1 and object2 should be given
  // when user2 lists all workspaces, only workspace2 should be given
  // user2 cannot update object1 but can update object2

  it('works', function () {
    // Create user1
    const password = 'password'
    // let response = request.post(`${baseUrl}/auth/signup`, {
    //   json: true,
    //   body: {email: 'user1@example.com', password}
    // })
    // if (response.statusCode !== 409 && response.statusCode !== 200) {
    //   // A 409 is okay; user already exists
    //   throw new Error('Invalid signup response: ' + String(response.body))
    // }
    // // Create user2
    // response = request.post(`${baseUrl}/auth/signup`, {
    //   json: true,
    //   body: {email: 'user2@example.com', password}
    // })
    // if (response.statusCode !== 409 && response.statusCode !== 200) {
    //   // A 409 is okay; user already exists
    //   throw new Error('Invalid signup response: ' + String(response.body))
    // }
    let response
    response = request.post(`${baseUrl}/auth/login`, {
      json: true,
      body: {email: 'user1@example.com', password}
    })
    if (response.statusCode !== 200) {
      throw new Error('Invalid login response: ' + String(response.body))
    }
    let token = response.headers['x-session-id']
    response = request.post(`${baseUrl}/workspaces`, {
      json: true,
      body: {name: 'workspace1'},
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 201) {
      throw new Error(`Invalid workspace creation response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const workspace1 = JSON.parse(response.body)._key
    response = request.post(`${baseUrl}/workspaces/${workspace1}/objects`, {
      json: true,
      body: {name: 'object1'},
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 201) {
      throw new Error(`Invalid object creation response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const object1 = JSON.parse(response.body)._key
    response = request.post(`${baseUrl}/workspaces/${workspace1}/copy`, {
      json: true,
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid workspace copy response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const workspace2 = JSON.parse(response.body)._key
    response = request.put(`${baseUrl}/workspaces/${workspace2}/objects/${object1}`, {
      json: true,
      body: {name: 'object2'},
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid object update response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const object2 = JSON.parse(response.body)._key
    response = request.delete(`${baseUrl}/workspaces/${workspace2}/objects/${object1}`, {
      json: true,
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid object delete response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    response = request.post(`${baseUrl}/workspaces/${workspace2}/viewer`, {
      json: true,
      body: 'user2@example.com',
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid viewer creation response (code was ${response.statusCode}): ${String(response.body)}`)
    }

    request.post(`${baseUrl}/auth/logout`)
    response = request.post(`${baseUrl}/auth/login`, {
      json: true,
      body: {email: 'user2@example.com', password: 'password'}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid login response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    token = response.headers['x-session-id']

    response = request.get(`${baseUrl}/workspaces`, {
      json: true,
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid workspace fetch response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const ws = JSON.parse(response.body)
      .map(ws => ws._key)
      .filter(key => key === workspace1 || key === workspace2)
    assert.equal(ws.length, 1)

    console.log('object1, object2', object1, object2)
    response = request.get(`${baseUrl}/objects`, {
      json: true,
      headers: {'x-session-id': token}
    })
    if (response.statusCode !== 200) {
      throw new Error(`Invalid object fetch response (code was ${response.statusCode}): ${String(response.body)}`)
    }
    const objs = JSON.parse(response.body)
      .map(o => o._key)
      .filter(key => key === object1 || key === object2)

    console.log('final objects:', objs)
    assert.equal(objs.length, 2)
  })
})
