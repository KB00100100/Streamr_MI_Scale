const app = getApp()

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

Page({
  data: {
    devices: [],
    connected: false,
    chs: [],
    weight_change: '',
    weight_stable: '0',
    weight_stable_kg: '0',
    weight_hidden: true,
    Stream_ID: '',
    API_KEY: ''
  },
  openBluetoothAdapter() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        this.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange(function (res) {
            console.log('onBluetoothAdapterStateChange', res)
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        if (res.discovering) {
          this.onBluetoothDeviceFound()
        } else if (res.available) {
          this.startBluetoothDevicesDiscovery()
        }
      }
    })
  },
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
    })
  },
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        if (device.name == 'MI_SCALE') {
          this.createBLEConnection(device.deviceId, device.name)
        } else {
          return
        }
      })
    })
  },
  createBLEConnection(device_id, device_name) {
    const deviceId = device_id
    const name = device_name
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
        })
        this.getBLEDeviceServices(deviceId)
      }
    })
    this.stopBluetoothDevicesDiscovery()
  },
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      connected: false,
      chs: [],
      canWrite: false,
    })
  },
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          console.log('device services:', res.services)
          if (res.services[i].uuid == "0000181D-0000-1000-8000-00805F9B34FB") {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      }
    })
  },
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          console.log(item.properties.notify || item.properties.indicate)
          /*if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              success: function (res) {
                console.log('readBLECharacteristicValue:', res.errCode)
              },
              fail:function (res){
                console.log('readBLECharacteristicValue failure.',res)
              }
            })
          }*/
          /*if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            this.writeBLECharacteristicValue()
          }*/
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
    // 操作之前先监听，保证第一时间获取数据，监听体重值是否发生变化
    wx.onBLECharacteristicValueChange((characteristic) => {

      if (characteristic.characteristicId == '00002A9D-0000-1000-8000-00805F9B34FB') {
        //console.log(ab2hex(characteristic.value))
        //console.log(ab2hex(characteristic.value).slice(0, 2)) value第一个字节，0x12代表体重瞬时值，0x32代表体重稳定值，0x92代表测量体重为0（进入休眠模式）
        //console.log(ab2hex(characteristic.value).slice(2, 4)) value第二个字节，体重值的低位字节
        //console.log(ab2hex(characteristic.value).slice(4, 6)) value第三个字节，体重值的高位字节
        //XiaoMi体重计体重数值用两个字节数据表示，（高位字节+低位字节）斤，转换为KG时需要除以2
        var weight = (parseInt(ab2hex(characteristic.value).slice(4, 6), 16) * 256 + parseInt(ab2hex(characteristic.value).slice(2, 4),16))/100
        console.log(weight)
        if (ab2hex(characteristic.value).slice(0, 2) == '12' && weight > 0){
          console.log('正在测量体重中...')
          this.setData({weight_hidden: false, weight_change: weight})
          this.drawCircle(weight/150)
        }
        else{
          console.log('测量体重结束...')
          this.setData({ weight_hidden: true, weight_stable: weight, weight_stable_kg: weight/2})
        }
      } 
      
    })
  },
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },
  //绘制圆环背景
  drawProgressbg: function () {
    // 使用 wx.createContext 获取绘图上下文 context
    var ctx = wx.createCanvasContext('canvasProgressbg')
    ctx.setLineWidth(4);// 设置圆环的宽度
    ctx.setStrokeStyle('#FFFFFF'); // 设置圆环的颜色
    ctx.setLineCap('round') // 设置圆环端点的形状
    ctx.beginPath();//开始一个新的路径
    ctx.arc(110, 110, 100, 0, 2 * Math.PI, false);
    //设置一个原点(100,100)，半径为90的圆的路径到当前路径
    ctx.stroke();//对当前路径进行描边
    ctx.draw();
  },
  //绘制一定长度的圆弧
  drawCircle: function (step) {
    var context = wx.createCanvasContext('canvasProgress');
    // 设置渐变
    var gradient = context.createLinearGradient(200, 100, 100, 200);
    gradient.addColorStop("0", "#2661DD");
    gradient.addColorStop("0.5", "#40ED94");
    gradient.addColorStop("1.0", "#5956CC");

    context.setLineWidth(10);
    context.setStrokeStyle(gradient);
    context.setLineCap('round')
    context.beginPath();
    // 参数step 为绘制的圆环周长，从0到2为一周 。 -Math.PI / 2 将起始角设在12点钟位置 ，结束角 通过改变 step 的值确定
    context.arc(110, 110, 100, -Math.PI / 2, step * Math.PI - Math.PI / 2, false);
    context.stroke();
    context.draw()
  },
  //页面加载
  onReady: function () {
    this.drawProgressbg();
  },
  //页面隐藏关闭蓝牙连接
  onHide: function () {
    this.closeBLEConnection();
    this.closeBluetoothAdapter();
  },
  //页面重新显示
  onShow: function () {
    var that = this
    if (!that.data.connected) {
      wx.showModal({
        title: '提示',
        content: '蓝牙连接已断开，请重新连接！',
        success: function (res) {
          if (res.confirm) {
            console.log('用户点击确定')
          } else if (res.cancel) {
            console.log('用户点击取消')
          }
        }
      })
    }
  },
  //连接MI体重计
  connect_MI_scale() {
    var that = this
    var fail_count = 0 
    //加载页面
    wx.showLoading({
      title: '连接MI体重计中...',
      success: (res) => {
        this.openBluetoothAdapter();
        var timer = setInterval(function () {
          if (that.data.connected){
            wx.hideLoading()
            /*wx.showModal({
              title: '提示',
              content: '成功连接MI体重计，开始测量体重并上传至Streamr市场吧！',
              success: function (res) {
                if (res.confirm) {
                  console.log('用户点击确定')
                } else if (res.cancel) {
                  console.log('用户点击取消')
                }
              }
            })*/
            clearInterval(timer);
            fail_count = 0
            return
          }
          if (fail_count == 20){
            wx.hideLoading()
            wx.showModal({
              title: '提示',
              content: '连接MI体重计失败，请确保手机蓝牙和体重计均已打开，并尽量靠近后重新尝试！',
              success: function (res) {
                if (res.confirm) {
                  console.log('用户点击确定')
                } else if (res.cancel) {
                  console.log('用户点击取消')
                }
              }
            })
            fail_count = 0
            clearInterval(timer);
            return
          }
          console.log('正在连接MI体重计...')
          fail_count++
        }, 1000) //循环时间 这里是1秒 
      }
    })
  },
  //
  upload_to_Streamr() {
    var that = this
    if (that.data.Stream_ID == '' || that.data.API_KEY == ''){
      wx.showModal({
        title: '提示',
        content: '请填写Stream ID和API key！',
        success: function (res) {
          if (res.confirm) {
            console.log('用户点击确定')
          }
          else {
            console.log('用户点击取消')
          }
        }
      })
    }
    else{
      wx.request({
        url: "$URL",  //这里没有直接选择Streamr官方Url，因为该Url没有备案，小程序无法直接访问
        header: {
          "Content-Type": "application/json;charset=utf-8"
        },
        data: {
          "Stream_ID": that.data.Stream_ID,
          "API_KEY": that.data.API_KEY,
          "Weight": that.data.weight_stable_kg
        },
        method: "POST",
        complete: function (res) {
          console.log(res);
          if (res.data == '200') {
            wx.showModal({
              title: '提示',
              content: '恭喜！数据上传至Streamr市场成功！:-)',
              success: function (res) {
                if (res.confirm) {
                  console.log('用户点击确定')
                }
                else {
                  console.log('用户点击取消')
                }
              }
            })
          }
          else{
            wx.showModal({
              title: '提示',
              content: '数据上传失败！请检查网络以及Stream ID、API key是否正确！ 错误码：' + res.data,
              success: function (res) {
                if (res.confirm) {
                  console.log('用户点击确定')
                }
                else {
                  console.log('用户点击取消')
                }
              }
            })
          }
        }
      })
    }

  },
  //获取用户输入的Stream ID
  OnStream_IDBlur: function (e) {
    this.setData({ Stream_ID: e.detail.value });
  }, 
  //获取用户输入的API key
  OnAPI_KEYBlur: function (e) {
    this.setData({ API_KEY: e.detail.value });
  }, 
})
