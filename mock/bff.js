/**
 * 测试脚本：获取并解析 blocks 数据
 * 复用 blocks.ts 中的方法
 */

import { fetchBlocks, parseBlockData, parseMarkupData } from '../src/api/blocks.ts'

// AntV X6 节点定义示例（自定义数据放在 data 字段）
const DerivativeBlockNode = {
  shape: 'rect',
  width: 80,
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
      refY: '120%',
      fontSize: 14,
      fill: '#000000',
      text: 'Derivative',
    },
    image: {
      xlinkHref: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI8AAADXBAMAAADRkB86AAAAMFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAv3aB7AAAAD3RSTlMAZjLdq0QQu4kime92zVTTEU4EAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAJOUlEQVRoBe1aPW9zSRW+fGyWXT6Slsr+B4m0BaKyJd6KxmmRkOyO0qmhcPpdyWmhsTsaJKeFV+K6A9Ek/8D+B/ESYJfNgvd5ztyZOWdmbhwnDUL3Fr7nPOdjZs48M9f23KpKr2/tcf09RV+hf4eJ/vGKwDRkzET7SQofr88k0fXxgUnER5Jnv0vg49WPXaLPj49MIqYu0WMCH6/OXaL95fGhNqLe779mrnsLH62RjrsNPt5KSdJx2MPHWyk5Ro7tKT7eSsnZfv9UfZeJro8uiw4gHb+svs1Etxo/WiYd/11VA9zeRknS8aqqeri9jZJ3yLCtKqn2myhZs9ZVJQsOPXv19SN06EtES7VRq9JFpv1HG74HYH+jkar6IaB/EdpA+MravMYyGtOHADgMfZ0DGxJ4gNBCyTEs/9VBLOgXGoA8AtYn9n0I+zWl7JrDYka9AMB6qIt0dMP/AaQWSs5SSw/AP1UWiJws1+sTSC2UrGExE7oCIIWNyTjaW6fSWqSk7OnXMcZNzIUGquoO0WsHLSAWd0kyxBoIDG2iGtDEQZxTO4LGVbjaOAkknDtrrO7Gxvx+9gETmclpXEk1M2aZl75JRJ+www6gGN41rqyjb00g2bxMnuocPvce6kHx4/QY73QyOwwpZ5aMo+PWB7VRsoe40G06TwHYrpM7cfSyFBsu+OS8j+C108AYgFkyFUO/Di5CSesgtgG8wviJzAHYWeFgVFtsOhk7wiT/kgn8NYOf7XkPyNKbXVXdCo5YVQktthqpEXalgWoA5CYiJEPK2ErGr72qfMmwLU0QWQt28Ggl28XyJWPoyI7VyJzsM26jMrtYtmQsHZnoDon2FPS1SLNnS0YIstUxUyZaawTyAzCzi50C0BWRebVbuHT6Ikm0QpzZxc4BRPbB29KR4TIfKSU3iDPJewDMkiEdTVNVNQOUUhKQ5cQIwE53uwdgqYGqGgNKKJnvYgP43Os4AjcaqCr5MTE0WLaLZUuGdDT8QLz8vLHDzXYxWTJnqjEy1kwrbTVAS8nDD/4FYi5UYhHnAC0lpkDMLiYPCR23gofuodgYZtExAMMITrYuidRMJxY5pyT7aBbyOQA9es6G1l1OoaSp3Ax+t7pBZtYeBTrSnXG64xV0u4ttAOiJfYA+1C05eQxYsyvbxaQkuosDBPTzRELJZcSFWZdRdxvmMAKkVbqqaE0pme1iLIneasgGM6u+DfqpSch2sR4d+t67qhZQ9UiDhZOiKHkK1RS/BqB30RXUdYhWwpSOZwE4h6aJLY/j+HR2T71JcFeCLNKLANwhkd4OmVhnJh11QyHQfXOPhBvBUZXsZABdfzdh7Q3xY6YNTLEq1NROL89QHfkA+1UM1hJNkZI1FFV7dtBstBuolzo8ykKUpddrOMba/4qa7gI34qfflq/f0TUspgG1PzZpPxJtv7/2zbifsHRpu8JEbejx5Dp/smrctyHRokFab6EsLvaLG4R+4PPsJyHRvDWDN2wb37EDHv/w19+L9Dk+QyuVbDLOo+3zvkkkpVdOv4Ac6SDPKmUtiP6ZLF+Gov2n1EMB3XMwWktSoORIW7+Sn1OR9w/a2CKzvLxk7TU+j3356bpzFnxuWoI1vPTevYA+bvED7927d9fedNz95NMm05/6xwXm3r/8Wf30k5//ODd0SFeBrgJdBboKdBXoKtBVoKtAV4GuAr4C4Zv824TdC35jvaiF/+tEvujdvatAV4GuAl0Fugr871VADjL8/5hv6Z4crcR/T1+faixfHSavT+AjZ5Lo2qul+ye4nnVgkJw2mb/zs1RyQLrO4ASQQyJzUpE4NOdK/QxOgKmMTL0ikdihZgekuQsQ/6f7ZdEqIOdVnfa0ONb4w5ud8n+tF9zY6fLxjnImHQ+9OjiGj3kTRcUHkd0e9vDxDCXvYG45Jwp55Dj80KuDMySK/67HWCPB6eCrgzUSXZmoXCEdD706mB2Q5mncu1oY/gD5WsuZv+ZRyMSZRa97uLUyJTsgLeSRFz22B14d5CGdOu0ppZFzfvpIo231PEWiZ8ghiTl8njTK+i5RRQ5D4STXUGKKH+y1nM1tIJRWwYeSofk4K+YQ8BwuQ0oP9J1QsheHFa6+tWltBCcxyynYWpucvAhZIORmj5Bq7oRcDsxuPR7v0tMmWeksvfHkZLkTcjnNL1By1SThrVTDJhEr0HSDEQVK/ub9+xqW/Xtcf44dTaU7uKwduKD7ZepA/SUbbY3giQuWeb5ysv3kPDxTHjqTjp6y8sJLiZLyPp06HretOI10DA/9AZRiOR9gcDNSyiHYOVzuvbUHxY/TY3KfAw8n08YSlBFctl5ro6QcXDZT632TO7kTZ1yWZykAXgc2WvuullCyUAvZaNdJH6zKwewixIEWplm+h11Gt4LUQ+Qy4iz9vh/1RpI9L0MNMEDgTUTktYdh1Bvp8IOfFPR0ZJA8LHJKnsKtyK/QpKEj0RohOYXHQAvbQkjjXqe8V3r51UFBA/21e5ANHYlO0bbfDIJXNQOo5jYavETe2KeVzM+Ft/t7DT/TcW/wd0tHokK9lJKHH/ykY7IWZ4BSSspcbn3rpXsPUUtrGANKKSlLcGL9rDZA0I2F5MfE0GIkiS2ltctbs+FFisYmyyoZLvmY+plU3KPjWxeNqQaYUPIcUHzNw6RwygIO2VTPASbj6AHKGtT5VnA40wDlKcAEHQHZpX5Kl21M6U4sUHKARFnPVeBLXx2UBpcqMBULdKTLDO2bOZLHXVYCle0BEUOlN+IYsGGX8PEmdwzIAAH9oAVBKLkMqnsl+pnvRULHdFUxPKMkS1By9G2Rjuk6FxtwQ8lFovsE/k77rVf0fQ6DpiRrWWyxCVrBvtYJvDyFQVOSjsnq8668CzsmGvGyfKtSBNwgUbHrLuDFrw7KycXQt5LfORf5E0z82IVIyUO/+FnCqzw/EZoiJeVb82XZk+gGzi1mdjZuwQe+iLLDL3t18MBGK+2w5bYrbImyZNpHtmhL4PFAyVMiS2SaFLPNfUDrfdvESaLHz/628YDN1xofDPdNgAyN6I3N4DSZ0xBTFPzXD9l74RHGavKFZoo5BPSUFEIC8brJ4zjXnkQsfigj5xem0WTaHEhC87KJkC+WB55sJnmrspJWd632FxtO/lI/ffLrrfb/Bg5ZgCGWOb+jAAAAAElFTkSuQmCC',
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
            attributes: {
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
            attributes: {
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

console.log('========== AntV X6 节点定义 ==========\n')
console.log(JSON.stringify(DerivativeBlockNode, null, 2))

async function main() {
  try {
    // 1. 使用 blocks.ts 中的 fetchBlocks 方法获取数据
    console.log('正在获取 blocks 数据...\n')
    const blocks = await fetchBlocks()
    
    if (blocks.length === 0) {
      console.warn('没有获取到任何 blocks 数据')
      return
    }
    
    console.log(`✓ 成功获取 ${blocks.length} 个 blocks\n`)
    
    // 2. 解析每个 block 中的 JSON 字符串
    console.log('========== 解析后的数据 ==========\n')
    const parsedBlocks = blocks.map((block) => {
      const parsedData = parseBlockData(block.data)
      const parsedMarkup = parseMarkupData(block.markup)
      
      return {
        id: block.id,
        type: block.type,
        data: parsedData,
        markup: parsedMarkup,
        icon: block.icon,
      }
    })
    
    console.log(JSON.stringify(parsedBlocks, null, 2))
    
    // 3. 详细打印每个 block 的信息
    console.log('\n========== Block 详细信息 ==========\n')
    parsedBlocks.forEach((block) => {
      console.log(`Block ID: ${block.id}`)
      console.log(`  Type: ${block.type}`)
      console.log(`  Data Type: ${block.data?.type}`)
      if (block.data?.props) {
        console.log(`  Title: ${block.data.props.title}`)
        console.log(`  Description: ${block.data.props.description}`)
        console.log(`  BlockType: ${block.data.props.blockType}`)
      }
      if (block.markup?.ports) {
        const portCount = block.markup.ports.items?.length || 0
        console.log(`  Ports Count: ${portCount}`)
        block.markup.ports.items?.forEach((port) => {
          console.log(`    - Port ID: ${port.id}, Group: ${port.group}`)
        })
      }
      console.log()
    })
  } catch (error) {
    console.error('❌ 处理 blocks 时出错:', error)
  }
}

// 直接执行
main()
