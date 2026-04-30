import { Graph, Stencil, StringExt } from '@antv/x6'

/**
 * Stencil入口
 * @param stencilContainer
 * @returns
 */
function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let graph!: Graph
  let resizeObserver!: ResizeObserver
  let activeColumns = 2
  const commonAttrs = {
    body: {
      fill: '#fff',
      stroke: 'black',
      strokeWidth: 1,
    },
  }
  /**
   * 挂载Stencil
   * @param g 全局Graph实例
   */
  function create(g: Graph): void {
    graph = g
    stencil = createStencil(activeColumns)
    const n1 = graph.createNode({
      shape: 'rect',
      width: 80,
      height: 40,
      label: 'rect',
      attrs: commonAttrs,
      ports: {
        items: [
          {
            group: 'in',
          },
          {
            group: 'out',
          },
        ],
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
    })

    const n2 = graph.createNode({
      shape: 'rect',
      width: 80,
      height: 40,
      label: 'Subsystem',
      ports: {
        items: [
          {
            id: 'port1',
            group: 'in',
          },
          {
            id: 'port2',
            group: 'out',
          },
        ],
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
      data: {
        type: 'SubsystemBlock',
        graphJson: {
          cells: [
            {
              position: {
                x: -776,
                y: -120,
              },
              size: {
                width: 50,
                height: 40,
              },
              attrs: {
                text: {
                  text: 'in',
                },
                body: {
                  fill: '#fff',
                  stroke: '#8f8f8f',
                  strokeWidth: 1,
                },
              },
              visible: true,
              shape: 'circle',
              id: '87e5c930-ce4e-48d0-a6f3-2b95633008ef',
              data: { type: 'InPort' },
              ports: {
                items: [
                  {
                    id: 'port2',
                    group: 'out',
                  },
                ],
                groups: {
                  out: {
                    position: 'right',
                    attrs: {
                      circle: {
                        r: 4,
                        magnet: true,
                        stroke: '#31d0c6',
                        strokeWidth: 2,
                      },
                    },
                  },
                },
              },
              zIndex: 3,
            },
            {
              position: {
                x: -598,
                y: -120,
              },
              size: {
                width: 50,
                height: 40,
              },
              attrs: {
                text: {
                  text: 'out',
                },
                body: {
                  fill: '#fff',
                  stroke: '#8f8f8f',
                  strokeWidth: 1,
                },
              },
              visible: true,
              shape: 'circle',
              id: '49fee7fd-2620-4efc-ac23-633af7ff5f96',
              data: { type: 'OutPort' },
              ports: {
                items: [
                  {
                    id: 'port1',
                    group: 'in',
                  },
                ],
                groups: {
                  in: {
                    position: 'left',
                    attrs: {
                      circle: {
                        r: 4,
                        magnet: true,
                        stroke: '#31d0c6',
                        strokeWidth: 2,
                      },
                    },
                  },
                },
              },
              zIndex: 4,
            },
            {
              shape: 'edge',
              id: 'a682cc6c-68f1-45ee-9156-e5dd5fe7006a',
              source: {
                cell: '87e5c930-ce4e-48d0-a6f3-2b95633008ef',
                port: 'port2',
              },
              target: {
                cell: '49fee7fd-2620-4efc-ac23-633af7ff5f96',
                port: 'port1',
              },
              zIndex: 5,
            },
          ],
        },
      },
    })
    const Derivative = {
      shape: 'rect',
      width: 60,
      height: 60,
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
        {
          tagName: 'image',
          selector: 'image',
        },
      ],
      attrs: {
        body: {
          refWidth: '100%',
          refHeight: '100%',
          strokeWidth: 2,
          stroke: '#000000',
          fill: '#FFFFFF',
        },
        label: {
          textVerticalAnchor: 'top',
          textAnchor: 'middle',
          refX: '50%',
          refY: '110%',
          fontSize: 14,
          fill: '#000000',
          text: 'Derivative',
        },
        image: {
          xlinkHref:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI8AAADXBAMAAADRkB86AAAAMFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAv3aB7AAAAD3RSTlMAZjLdq0QQu4kime92zVTTEU4EAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAJOUlEQVRoBe1aPW9zSRW+fGyWXT6Slsr+B4m0BaKyJd6KxmmRkOyO0qmhcPpdyWmhsTsaJKeFV+K6A9Ek/8D+B/ESYJfNgvd5ztyZOWdmbhwnDUL3Fr7nPOdjZs48M9f23KpKr2/tcf09RV+hf4eJ/vGKwDRkzET7SQofr88k0fXxgUnER5Jnv0vg49WPXaLPj49MIqYu0WMCH6/OXaL95fGhNqLe779mrnsLH62RjrsNPt5KSdJx2MPHWyk5Ro7tKT7eSsnZfv9UfZeJro8uiw4gHb+svs1Etxo/WiYd/11VA9zeRknS8aqqeri9jZJ3yLCtKqn2myhZs9ZVJQsOPXv19SN06EtES7VRq9JFpv1HG74HYH+jkar6IaB/EdpA+MravMYyGtOHADgMfZ0DGxJ4gNBCyTEs/9VBLOgXGoA8AtYn9n0I+zWl7JrDYka9AMB6qIt0dMP/AaQWSs5SSw/AP1UWiJws1+sTSC2UrGExE7oCIIWNyTjaW6fSWqSk7OnXMcZNzIUGquoO0WsHLSAWd0kyxBoIDG2iGtDEQZxTO4LGVbjaOAkknDtrrO7Gxvx+9gETmclpXEk1M2aZl75JRJ+www6gGN41rqyjb00g2bxMnuocPvce6kHx4/QY73QyOwwpZ5aMo+PWB7VRsoe40G06TwHYrpM7cfSyFBsu+OS8j+C108AYgFkyFUO/Di5CSesgtgG8wviJzAHYWeFgVFtsOhk7wiT/kgn8NYOf7XkPyNKbXVXdCo5YVQktthqpEXalgWoA5CYiJEPK2ErGr72qfMmwLU0QWQt28Ggl28XyJWPoyI7VyJzsM26jMrtYtmQsHZnoDon2FPS1SLNnS0YIstUxUyZaawTyAzCzi50C0BWRebVbuHT6Ikm0QpzZxc4BRPbB29KR4TIfKSU3iDPJewDMkiEdTVNVNQOUUhKQ5cQIwE53uwdgqYGqGgNKKJnvYgP43Os4AjcaqCr5MTE0WLaLZUuGdDT8QLz8vLHDzXYxWTJnqjEy1kwrbTVAS8nDD/4FYi5UYhHnAC0lpkDMLiYPCR23gofuodgYZtExAMMITrYuidRMJxY5pyT7aBbyOQA9es6G1l1OoaSp3Ax+t7pBZtYeBTrSnXG64xV0u4ttAOiJfYA+1C05eQxYsyvbxaQkuosDBPTzRELJZcSFWZdRdxvmMAKkVbqqaE0pme1iLIneasgGM6u+DfqpSch2sR4d+t67qhZQ9UiDhZOiKHkK1RS/BqB30RXUdYhWwpSOZwE4h6aJLY/j+HR2T71JcFeCLNKLANwhkd4OmVhnJh11QyHQfXOPhBvBUZXsZABdfzdh7Q3xY6YNTLEq1NROL89QHfkA+1UM1hJNkZI1FFV7dtBstBuolzo8ykKUpddrOMba/4qa7gI34qfflq/f0TUspgG1PzZpPxJtv7/2zbifsHRpu8JEbejx5Dp/smrctyHRokFab6EsLvaLG4R+4PPsJyHRvDWDN2wb37EDHv/w19+L9Dk+QyuVbDLOo+3zvkkkpVdOv4Ac6SDPKmUtiP6ZLF+Gov2n1EMB3XMwWktSoORIW7+Sn1OR9w/a2CKzvLxk7TU+j3356bpzFnxuWoI1vPTevYA+bvED7927d9fedNz95NMm05/6xwXm3r/8Wf30k5//ODd0SFeBrgJdBboKdBXoKtBVoKtAV4GuAr4C4Zv824TdC35jvaiF/+tEvujdvatAV4GuAl0Fugr871VADjL8/5hv6Z4crcR/T1+faixfHSavT+AjZ5Lo2qul+ye4nnVgkJw2mb/zs1RyQLrO4ASQQyJzUpE4NOdK/QxOgKmMTL0ikdihZgekuQsQ/6f7ZdEqIOdVnfa0ONb4w5ud8n+tF9zY6fLxjnImHQ+9OjiGj3kTRcUHkd0e9vDxDCXvYG45Jwp55Dj80KuDMySK/67HWCPB6eCrgzUSXZmoXCEdD706mB2Q5mncu1oY/gD5WsuZv+ZRyMSZRa97uLUyJTsgLeSRFz22B14d5CGdOu0ppZFzfvpIo231PEWiZ8ghiTl8njTK+i5RRQ5D4STXUGKKH+y1nM1tIJRWwYeSofk4K+YQ8BwuQ0oP9J1QsheHFa6+tWltBCcxyynYWpucvAhZIORmj5Bq7oRcDsxuPR7v0tMmWeksvfHkZLkTcjnNL1By1SThrVTDJhEr0HSDEQVK/ub9+xqW/Xtcf44dTaU7uKwduKD7ZepA/SUbbY3giQuWeb5ysv3kPDxTHjqTjp6y8sJLiZLyPp06HretOI10DA/9AZRiOR9gcDNSyiHYOVzuvbUHxY/TY3KfAw8n08YSlBFctl5ro6QcXDZT632TO7kTZ1yWZykAXgc2WvuullCyUAvZaNdJH6zKwewixIEWplm+h11Gt4LUQ+Qy4iz9vh/1RpI9L0MNMEDgTUTktYdh1Bvp8IOfFPR0ZJA8LHJKnsKtyK/QpKEj0RohOYXHQAvbQkjjXqe8V3r51UFBA/21e5ANHYlO0bbfDIJXNQOo5jYavETe2KeVzM+Ft/t7DT/TcW/wd0tHokK9lJKHH/ykY7IWZ4BSSspcbn3rpXsPUUtrGANKKSlLcGL9rDZA0I2F5MfE0GIkiS2ltctbs+FFisYmyyoZLvmY+plU3KPjWxeNqQaYUPIcUHzNw6RwygIO2VTPASbj6AHKGtT5VnA40wDlKcAEHQHZpX5Kl21M6U4sUHKARFnPVeBLXx2UBpcqMBULdKTLDO2bOZLHXVYCle0BEUOlN+IYsGGX8PEmdwzIAAH9oAVBKLkMqnsl+pnvRULHdFUxPKMkS1By9G2Rjuk6FxtwQ8lFovsE/k77rVf0fQ6DpiRrWWyxCVrBvtYJvDyFQVOSjsnq8668CzsmGvGyfKtSBNwgUbHrLuDFrw7KycXQt5LfORf5E0z82IVIyUO/+FnCqzw/EZoiJeVb82XZk+gGzi1mdjZuwQe+iLLDL3t18MBGK+2w5bYrbImyZNpHtmhL4PFAyVMiS2SaFLPNfUDrfdvESaLHz/628YDN1xofDPdNgAyN6I3N4DSZ0xBTFPzXD9l74RHGavKFZoo5BPSUFEIC8brJ4zjXnkQsfigj5xem0WTaHEhC87KJkC+WB55sJnmrspJWd632FxtO/lI/ffLrrfb/Bg5ZgCGWOb+jAAAAAElFTkSuQmCC',
          refWidth: '66%',
          refHeight: '66%',
          refDx: '-83%',
          refDy: '-83%',
        },
      },
      ports: {
        items: [
          {
            id: 'i1',
            group: 'in',
          },
          {
            id: 'o1',
            group: 'out',
          },
        ],
        groups: {
          in: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z',
                },
              },
            ],
            z: 1,
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
            position: {
              name: 'left',
            },
            label: {
              position: {
                name: 'left',
              },
            },
          },
          out: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z',
                },
              },
            ],
            z: -1,
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
            position: {
              name: 'right',
            },
            label: {
              position: {
                name: 'right',
              },
            },
          },
        },
      },
      // 自定义数据放在 data 字段
      data: {
        blockType: 'Derivative',
        title: 'Derivative',
        srcBlock: 'simulink/Continuous/Derivative',
        description: 'Numerical derivative for the input signal.',
        paramValues: [],
        paramLables: [],
        level: 10,
      },
    }
    console.log(JSON.stringify(Derivative, null, 2))
    console.log(JSON.parse(JSON.stringify(Derivative, null, 2)))
    const nn2 = graph.createNode({
      shape: 'circle',
      width: 50,
      height: 40,
      label: 'out',
      attrs: commonAttrs,
      data: { type: 'OutPort' },
      ports: {
        items: [
          {
            id: 'port1',
            group: 'in',
          },
        ],
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
    })
    const nn = graph.createNode({
      shape: 'circle',
      width: 50,
      height: 40,
      label: 'in',
      attrs: commonAttrs,
      data: { type: 'InPort' },
      ports: {
        items: [
          {
            id: 'port2',
            group: 'out',
          },
        ],
        groups: {
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
    })
    const n3 = graph.createNode({
      shape: 'circle',
      x: 280,
      y: 40,
      width: 80,
      height: 40,
      label: 'ellipse',
      attrs: commonAttrs,
    })

    const n4 = graph.createNode({
      shape: 'path',
      x: 420,
      y: 40,
      width: 40,
      height: 40,
      // https://www.svgrepo.com/svg/13653/like
      path: 'M24.85,10.126c2.018-4.783,6.628-8.125,11.99-8.125c7.223,0,12.425,6.179,13.079,13.543c0,0,0.353,1.828-0.424,5.119c-1.058,4.482-3.545,8.464-6.898,11.503L24.85,48L7.402,32.165c-3.353-3.038-5.84-7.021-6.898-11.503c-0.777-3.291-0.424-5.119-0.424-5.119C0.734,8.179,5.936,2,13.159,2C18.522,2,22.832,5.343,24.85,10.126z',
      attrs: commonAttrs,
      label: 'path',
    })

    stencil.load([n1, n2, nn, nn2], 'group1')
    stencil.load([n3, n4], 'group2')
    stencilContainer.appendChild(stencil.container)
  }
  function dispose(): void {
    resizeObserver?.disconnect()
    stencil.dispose()
  }

  // ── Private functions 业务修改────────────────────────────────
  function createStencil(columns: number): Stencil {
    return new Stencil({
      target: graph,
      // 模板画布宽度。
      stencilGraphWidth: 200,
      // 模板画布高度，设置为 0 则自动根据内容调整高度。
      stencilGraphHeight: 0,
      groups: [
        {
          name: 'group1',
          title: 'Group(Collapsable)',
        },
        {
          name: 'group2',
          title: 'Group',
          collapsable: false,
        },
      ],
      search(cell, keyword) {
        return cell.shape.indexOf(keyword) !== -1
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: 10,
      notFoundText: 'NOT FOUND',
      getDragNode(node) {
        const cloned = node.clone()
        cloned.getPorts().forEach((port) => {
          if (port.id) {
            cloned.portProp(port.id, 'id', StringExt.uuid())
          }
        })
        return cloned
      },
      // layoutOptions: {
      //   columns,
      //   columnWidth: NODE_SIZE + NODE_GAP,
      //   rowHeight: NODE_SIZE + NODE_GAP + LABEL_H,
      //   dx: 0,
      //   dy: 0,
      //   marginX: SIDE_PAD,
      //   marginY: SIDE_PAD,
      // },
    })
  }

  function UpdateStencil(): void {
    stencil!.dispose()
    stencil = createStencil(activeColumns)
  }

  function collapseAll(): void {
    stencil?.collapseGroups()
  }

  function expandAll(): void {
    stencil?.expandGroups()
  }

  return {
    create,
    dispose,
    collapseAll,
    expandAll,
  }
}

export { createStencilService }
