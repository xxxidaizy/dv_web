import * as THREE from "@public/libs/three.js/build/three.module.js";

// https://stackoverflow.com/a/56532878
function memcpy(
  src,
  srcOffset,
  dst,
  dstOffset,
  length,
) {
  let i
  // @ts-ignore
  src = src.subarray || src.slice ? src : src.buffer
  // @ts-ignore
  dst = dst.subarray || dst.slice ? dst : dst.buffer
  src = srcOffset
    ? // @ts-ignore
      src.subarray
      ? // @ts-ignore
        src.subarray(srcOffset, length && srcOffset + length)
      : // @ts-ignore
        src.slice(srcOffset, length && srcOffset + length)
    : src
  // @ts-ignore
  if (dst.set) {
    // @ts-ignore
    dst.set(src, dstOffset)
  } else {
    // @ts-ignore
    for (i = 0; i < src.length; i++) dst[i + dstOffset] = src[i]
  }
  return dst
}
function convertPoints(points) {
  if (points instanceof Float32Array) return points
  if (points instanceof THREE.BufferGeometry) return points.getAttribute('position').array
  return points
    .map((p) => {
      const isArray = Array.isArray(p)
      return p instanceof THREE.Vector3
        ? [p.x, p.y, p.z]
        : p instanceof THREE.Vector2
        ? [p.x, p.y, 0]
        : isArray && p.length === 3
        ? [p[0], p[1], p[2]]
        : isArray && p.length === 2
        ? [p[0], p[1], 0]
        : p
    })
    .flat()
}

export class MeshLine extends THREE.BufferGeometry {
  type = 'MeshLine'
  isMeshLine = true
  position = []
  previou = []
  nex = []
  sid = []
  widt = []
  indices_arra = []
  uv = []
  counter = []
  widthCallback = null

  _attributes = {
    position: THREE.BufferAttribute,
    previous: THREE.BufferAttribute,
    next: THREE.BufferAttribute,
    side: THREE.BufferAttribute,
    width: THREE.BufferAttribute,
    uv: THREE.BufferAttribute,
    index: THREE.BufferAttribute,
    counters: THREE.BufferAttribute
  }
  _points = []
  // Used to raycast
  matrixWorld = new THREE.Matrix4()

  constructor() {
    super()

    Object.defineProperties(this, {
      points: {
        enumerable: true,
        get() {
          return this._points
        },
        set(value) {
          this.setPoints(value, this.widthCallback)
        },
      },
    })
  }

  setMatrixWorld(matrixWorld) {
    this.matrixWorld = matrixWorld
  }

  setPoints(points, wcb) {
    points = convertPoints(points)
    // as the points are mutated we store them
    // for later retreival when necessary (declaritive architectures)
    this._points = points
    this.widthCallback = wcb
    this.positions = []
    this.counters = []

    // TODO: this is unreachable
    if (points.length && (points[0]) instanceof THREE.Vector3) {
      // could transform Vector3 array into the array used below
      // but this approach will only loop through the array once
      // and is more performant
      for (let j = 0; j < points.length; j++) {
        const p = points[j]
        const c = j / (points.length - 1)
        this.positions.push(p.x, p.y, p.z)
        this.positions.push(p.x, p.y, p.z)
        this.counters.push(c)
        this.counters.push(c)
      }
    } else {
      for (let j = 0; j < points.length; j += 3) {
        const c = j / (points.length - 1)
        this.positions.push(points[j], points[j + 1], points[j + 2])
        this.positions.push(points[j], points[j + 1], points[j + 2])
        this.counters.push(c)
        this.counters.push(c)
      }
    }
    this.process()
  }

  compareV3(a, b) {
    const aa = a * 6
    const ab = b * 6
    return (
      this.positions[aa] === this.positions[ab] &&
      this.positions[aa + 1] === this.positions[ab + 1] &&
      this.positions[aa + 2] === this.positions[ab + 2]
    )
  }

  copyV3(a){
    const aa = a * 6
    return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]]
  }

  process() {
    const l = this.positions.length / 6

    this.previous = []
    this.next = []
    this.side = []
    this.width = []
    this.indices_array = []
    this.uvs = []

    let w

    let v
    // initial previous points
    if (this.compareV3(0, l - 1)) {
      v = this.copyV3(l - 2)
    } else {
      v = this.copyV3(0)
    }
    this.previous.push(v[0], v[1], v[2])
    this.previous.push(v[0], v[1], v[2])

    for (let j = 0; j < l; j++) {
      // sides
      this.side.push(1)
      this.side.push(-1)

      // widths
      if (this.widthCallback) w = this.widthCallback(j / (l - 1))
      else w = 1
      this.width.push(w)
      this.width.push(w)

      // uvs
      this.uvs.push(j / (l - 1), 0)
      this.uvs.push(j / (l - 1), 1)

      if (j < l - 1) {
        // points previous to poisitions
        v = this.copyV3(j)
        this.previous.push(v[0], v[1], v[2])
        this.previous.push(v[0], v[1], v[2])

        // indices
        const n = j * 2
        this.indices_array.push(n, n + 1, n + 2)
        this.indices_array.push(n + 2, n + 1, n + 3)
      }
      if (j > 0) {
        // points after poisitions
        v = this.copyV3(j)
        this.next.push(v[0], v[1], v[2])
        this.next.push(v[0], v[1], v[2])
      }
    }

    // last next point
    if (this.compareV3(l - 1, 0)) {
      v = this.copyV3(1)
    } else {
      v = this.copyV3(l - 1)
    }
    this.next.push(v[0], v[1], v[2])
    this.next.push(v[0], v[1], v[2])

    if (!this._attributes || this._attributes.position.count !== this.counters.length) {
      this._attributes = {
        position: new THREE.BufferAttribute(new Float32Array(this.positions), 3),
        previous: new THREE.BufferAttribute(new Float32Array(this.previous), 3),
        next: new THREE.BufferAttribute(new Float32Array(this.next), 3),
        side: new THREE.BufferAttribute(new Float32Array(this.side), 1),
        width: new THREE.BufferAttribute(new Float32Array(this.width), 1),
        uv: new THREE.BufferAttribute(new Float32Array(this.uvs), 2),
        index: new THREE.BufferAttribute(new Uint16Array(this.indices_array), 1),
        counters: new THREE.BufferAttribute(new Float32Array(this.counters), 1),
      }
    } else {
      this._attributes.position.copyArray(new Float32Array(this.positions))
      this._attributes.position.needsUpdate = true
      this._attributes.previous.copyArray(new Float32Array(this.previous))
      this._attributes.previous.needsUpdate = true
      this._attributes.next.copyArray(new Float32Array(this.next))
      this._attributes.next.needsUpdate = true
      this._attributes.side.copyArray(new Float32Array(this.side))
      this._attributes.side.needsUpdate = true
      this._attributes.width.copyArray(new Float32Array(this.width))
      this._attributes.width.needsUpdate = true
      this._attributes.uv.copyArray(new Float32Array(this.uvs))
      this._attributes.uv.needsUpdate = true
      this._attributes.index.copyArray(new Uint16Array(this.indices_array))
      this._attributes.index.needsUpdate = true
    }

    this.setAttribute('position', this._attributes.position)
    this.setAttribute('previous', this._attributes.previous)
    this.setAttribute('next', this._attributes.next)
    this.setAttribute('side', this._attributes.side)
    this.setAttribute('width', this._attributes.width)
    this.setAttribute('uv', this._attributes.uv)
    this.setAttribute('counters', this._attributes.counters)

    this.setAttribute('position', this._attributes.position)
    this.setAttribute('previous', this._attributes.previous)
    this.setAttribute('next', this._attributes.next)
    this.setAttribute('side', this._attributes.side)
    this.setAttribute('width', this._attributes.width)
    this.setAttribute('uv', this._attributes.uv)
    this.setAttribute('counters', this._attributes.counters)

    this.setIndex(this._attributes.index)

    this.computeBoundingSphere()
    this.computeBoundingBox()
  }

  /**
   * Fast method to advance the line by one position.  The oldest position is removed.
   * @param position
   */
  advance({ x, y, z }) {
    const positions = this._attributes.position.array 
    const previous = this._attributes.previous.array 
    const next = this._attributes.next.array 
    const l = positions.length

    // PREVIOUS
    memcpy(positions, 0, previous, 0, l)

    // POSITIONS
    memcpy(positions, 6, positions, 0, l - 6)

    positions[l - 6] = x
    positions[l - 5] = y
    positions[l - 4] = z
    positions[l - 3] = x
    positions[l - 2] = y
    positions[l - 1] = z

    // NEXT
    memcpy(positions, 6, next, 0, l - 6)

    next[l - 6] = x
    next[l - 5] = y
    next[l - 4] = z
    next[l - 3] = x
    next[l - 2] = y
    next[l - 1] = z

    this._attributes.position.needsUpdate = true
    this._attributes.previous.needsUpdate = true
    this._attributes.next.needsUpdate = true
  }
}


const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>

  attribute vec3 previous;
  attribute vec3 next;
  attribute float side;
  attribute float width;
  attribute float counters;
  
  uniform vec2 resolution;
  uniform float lineWidth;
  uniform vec3 color;
  uniform float opacity;
  uniform float sizeAttenuation;
  
  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  
  vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
  }
  
  void main() {
    float aspect = resolution.x / resolution.y;
    vColor = vec4(color, opacity);
    vUV = uv;
    vCounters = counters;
  
    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4(position, 1.0) * aspect;
    vec4 prevPos = m * vec4(previous, 1.0);
    vec4 nextPos = m * vec4(next, 1.0);
  
    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(prevPos, aspect);
    vec2 nextP = fix(nextPos, aspect);
  
    float w = lineWidth * width;
  
    vec2 dir;
    if (nextP == currentP) dir = normalize(currentP - prevP);
    else if (prevP == currentP) dir = normalize(nextP - currentP);
    else {
      vec2 dir1 = normalize(currentP - prevP);
      vec2 dir2 = normalize(nextP - currentP);
      dir = normalize(dir1 + dir2);
  
      vec2 perp = vec2(-dir1.y, dir1.x);
      vec2 miter = vec2(-dir.y, dir.x);
      //w = clamp(w / dot(miter, perp), 0., 4. * lineWidth * width);
    }
  
    //vec2 normal = (cross(vec3(dir, 0.), vec3(0., 0., 1.))).xy;
    vec4 normal = vec4(-dir.y, dir.x, 0., 1.);
    normal.xy *= .5 * w;
    //normal *= projectionMatrix;
    if (sizeAttenuation == 0.) {
      normal.xy *= finalPosition.w;
      normal.xy /= (vec4(resolution, 0., 1.) * projectionMatrix).xy * aspect;
    }
  
    finalPosition.xy += normal.xy * side;
    gl_Position = finalPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

const version = /* @__PURE__ */ (() => parseInt(THREE.REVISION.replace(/\D+/g, '')))()
const colorspace_fragment = version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  
  uniform sampler2D map;
  uniform sampler2D alphaMap;
  uniform float useGradient;
  uniform float useMap;
  uniform float useAlphaMap;
  uniform float useDash;
  uniform float dashArray;
  uniform float dashOffset;
  uniform float dashRatio;
  uniform float visibility;
  uniform float alphaTest;
  uniform vec2 repeat;
  uniform vec3 gradient[2];
  
  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  
  void main() {
    #include <logdepthbuf_fragment>
    vec4 diffuseColor = vColor;
    if (useGradient == 1.) diffuseColor = vec4(mix(gradient[0], gradient[1], vCounters), 1.0);
    if (useMap == 1.) diffuseColor *= texture2D(map, vUV * repeat);
    if (useAlphaMap == 1.) diffuseColor.a *= texture2D(alphaMap, vUV * repeat).a;
    if (diffuseColor.a < alphaTest) discard;
    if (useDash == 1.) diffuseColor.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
    diffuseColor.a *= step(vCounters, visibility);
    #include <clipping_planes_fragment>
    gl_FragColor = diffuseColor;     
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <${colorspace_fragment}>
  }
`

// export interface MeshLineMaterialParameters {
//   lineWidth?: number
//   map?: THREE.Texture
//   useMap?: number
//   alphaMap?: THREE.Texture
//   useAlphaMap?: number
//   color?: string | THREE.Color | number
//   gradient?: string[] | THREE.Color[] | number[]
//   opacity?: number
//   resolution: THREE.Vector2 // required
//   sizeAttenuation?: number
//   dashArray?: number
//   dashOffset?: number
//   dashRatio?: number
//   useDash?: number
//   useGradient?: number
//   visibility?: number
//   alphaTest?: number
//   repeat?: THREE.Vector2
// }

export class MeshLineMaterial extends THREE.ShaderMaterial {
  lineWidth
  map
  useMap
  alphaMap 
  useAlphaMap 
  color
  gradient 
  resolution 
  sizeAttenuation 
  dashArray 
  dashOffset 
  dashRatio 
  useDash
  useGradient 
  visibility 
  repeat

  constructor(parameters) {
    super({
      uniforms: {
        ...THREE.UniformsLib.fog,
        lineWidth: { value: 1 },
        map: { value: null },
        useMap: { value: 0 },
        alphaMap: { value: null },
        useAlphaMap: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        gradient: { value: [new THREE.Color(0xff0000), new THREE.Color(0x00ff00)] },
        opacity: { value: 1 },
        resolution: { value: new THREE.Vector2(1, 1) },
        sizeAttenuation: { value: 1 },
        dashArray: { value: 0 },
        dashOffset: { value: 0 },
        dashRatio: { value: 0.5 },
        useDash: { value: 0 },
        useGradient: { value: 0 },
        visibility: { value: 1 },
        alphaTest: { value: 0 },
        repeat: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
    })

    this.type = 'MeshLineMaterial'
    Object.defineProperties(this, {
      lineWidth: {
        enumerable: true,
        get() {
          return this.uniforms.lineWidth.value
        },
        set(value) {
          this.uniforms.lineWidth.value = value
        },
      },
      map: {
        enumerable: true,
        get() {
          return this.uniforms.map.value
        },
        set(value) {
          this.uniforms.map.value = value
        },
      },
      useMap: {
        enumerable: true,
        get() {
          return this.uniforms.useMap.value
        },
        set(value) {
          this.uniforms.useMap.value = value
        },
      },
      alphaMap: {
        enumerable: true,
        get() {
          return this.uniforms.alphaMap.value
        },
        set(value) {
          this.uniforms.alphaMap.value = value
        },
      },
      useAlphaMap: {
        enumerable: true,
        get() {
          return this.uniforms.useAlphaMap.value
        },
        set(value) {
          this.uniforms.useAlphaMap.value = value
        },
      },
      color: {
        enumerable: true,
        get() {
          return this.uniforms.color.value
        },
        set(value) {
          this.uniforms.color.value = value
        },
      },
      gradient: {
        enumerable: true,
        get() {
          return this.uniforms.gradient.value
        },
        set(value) {
          this.uniforms.gradient.value = value
        },
      },
      opacity: {
        enumerable: true,
        get() {
          return this.uniforms.opacity.value
        },
        set(value) {
          this.uniforms.opacity.value = value
        },
      },
      resolution: {
        enumerable: true,
        get() {
          return this.uniforms.resolution.value
        },
        set(value) {
          this.uniforms.resolution.value.copy(value)
        },
      },
      sizeAttenuation: {
        enumerable: true,
        get() {
          return this.uniforms.sizeAttenuation.value
        },
        set(value) {
          this.uniforms.sizeAttenuation.value = value
        },
      },
      dashArray: {
        enumerable: true,
        get() {
          return this.uniforms.dashArray.value
        },
        set(value) {
          this.uniforms.dashArray.value = value
          this.useDash = value !== 0 ? 1 : 0
        },
      },
      dashOffset: {
        enumerable: true,
        get() {
          return this.uniforms.dashOffset.value
        },
        set(value) {
          this.uniforms.dashOffset.value = value
        },
      },
      dashRatio: {
        enumerable: true,
        get() {
          return this.uniforms.dashRatio.value
        },
        set(value) {
          this.uniforms.dashRatio.value = value
        },
      },
      useDash: {
        enumerable: true,
        get() {
          return this.uniforms.useDash.value
        },
        set(value) {
          this.uniforms.useDash.value = value
        },
      },
      useGradient: {
        enumerable: true,
        get() {
          return this.uniforms.useGradient.value
        },
        set(value) {
          this.uniforms.useGradient.value = value
        },
      },
      visibility: {
        enumerable: true,
        get() {
          return this.uniforms.visibility.value
        },
        set(value) {
          this.uniforms.visibility.value = value
        },
      },
      alphaTest: {
        enumerable: true,
        get() {
          return this.uniforms.alphaTest.value
        },
        set(value) {
          this.uniforms.alphaTest.value = value
        },
      },
      repeat: {
        enumerable: true,
        get() {
          return this.uniforms.repeat.value
        },
        set(value) {
          this.uniforms.repeat.value.copy(value)
        },
      },
    })
    this.setValues(parameters)
  }

  copy(source) {
    super.copy(source)
    this.lineWidth = source.lineWidth
    this.map = source.map
    this.useMap = source.useMap
    this.alphaMap = source.alphaMap
    this.useAlphaMap = source.useAlphaMap
    this.color.copy(source.color)
    this.gradient = source.gradient
    this.opacity = source.opacity
    this.resolution.copy(source.resolution)
    this.sizeAttenuation = source.sizeAttenuation
    this.dashArray = source.dashArray
    this.dashOffset = source.dashOffset
    this.dashRatio = source.dashRatio
    this.useDash = source.useDash
    this.useGradient = source.useGradient
    this.visibility = source.visibility
    this.alphaTest = source.alphaTest
    this.repeat.copy(source.repeat)
    return this
  }
}