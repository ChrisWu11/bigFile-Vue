<template>
  <div id="app">
    <el-upload
      drag
      action
      :auto-upload="false" 
      :show-file-list="false" 
      :on-change="changeFile"
      >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
    </el-upload>
    <el-button @click="handleBtn">开启/暂停上传</el-button>
    <el-progress :text-inside="true" :stroke-width="26" :percentage="count"></el-progress>
  </div>
</template>

<script>
import SparkMD5 from "spark-md5";
import axios from 'axios'
export default {
  name: 'App',
  data () {
    return {
      btn: false,
      hash: '',  // 上传文件的hash
      partList: [],  // 大文件分片的集合
      count: 0,
      abort: false
    }
  },
  methods: {
    /**
     * 将文件变为二进制，
     * 方便后续的分片
     */
    filepParse(file, type) {
      const caseType = {
        'base64': 'readAsDataURL',
        'buffer': 'readAsArrayBuffer'
      }
      const fileRead = new FileReader()
      return new Promise(resolve => {
        fileRead[caseType[type]](file)
        fileRead.onload = (res) => {
          resolve(res.target.result)
        }
      })
    }, 
    /**
     * 提交文件后触发
     */
    async changeFile(fileObj) {
      if (!fileObj) { return }
      const file = fileObj.raw
      const buffer = await this.filepParse(file,'buffer')
      
      const sparkMD5 = new SparkMD5.ArrayBuffer()

      sparkMD5.append(buffer)
      this.hash = sparkMD5.end()
      
      // 后缀名
      const suffix = /\.([0-9a-zA-Z]+)$/i.exec(file.name)[1];


      // 创建切片
      const partList = []
      const partSize = file.size / 20
      let current = 0

      for (let i = 0 ;i < 20 ;i++) {
        let reqItem = {
          chunk: file.slice(current, current + partSize),
          filename: `${this.hash}_${i}.${suffix}`
        }
        current += partSize
        partList.push(reqItem)
      }
      this.partList = partList
      this.sendQeq()
    },
    /**
     * 创建20 切片请求
     */
    createSendQeq() {
      const reqPartList = []
      this.partList.forEach((item,index) => {
        const reqFn = () => {
          const formData = new FormData();
          formData.append("chunk", item.chunk);
          formData.append("filename", item.filename);
          return axios.post("/upload",formData,{
            headers: {"Content-Type": "multipart/form-data"}
          }).then(res => {
            if (res.data.code === 0) {
              this.count += 5;
              // 传完的切片我们把它移除掉
              this.partList.splice(index, 1);
            }
          })
        }
        reqPartList.push(reqFn)
      })
      return reqPartList
    },
    /**
     * 发送请求
     */
    sendQeq() {
      const reqPartList = this.createSendQeq()
      let i  = 0 
      let send = async () => {
        if (this.abort) return;
        if (i >= reqPartList.length) { 
          // 上传完成
          this.mergeUpload()
          return 
        }
        await reqPartList[i]()
        i++
        send()
      }
      send()
      
    },
    /**
     * 上传完成
     */
    mergeUpload() {
      axios.get("/merge",{
        params: {
          hash: this.hash
        }
      }).then(res => {
        const result = res.data
        if (result.code === 0) {
          console.log(`上传成功${result}`)
          this.count = 0;
          alert('上传成功')
        }
      })
    },
    handleBtn() {
      if (this.btn) {
        //断点续传
        this.abort = false;
        this.btn = false;
        this.sendQeq();
        return;
      }
      //暂停上传
      this.abort = true;
      this.btn = true
    }
  }
}
</script>
