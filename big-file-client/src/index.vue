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
  </div>
</template>

<script>
import SparkMD5 from "spark-md5";
import axios from 'axios'
export default {
  name: 'App',
  data () {
    return {
      hash: '',  // 上传文件的hash
      partList: [],  // 大文件分片的集合
    }
  },
  methods: {
    // 提交文件后触发
    changeFile() {
        this.filepParse()

        // coding... 进行分片
        // ...
        
        // 创建切片请求
        this.createSendQeq()
        this.sendQeq()
        this.mergeUpload
    },
    // 将文件变成二进制，方便后续分片
    filepParse() {
    },
    // 创建切片请求
    createSendQeq() {
    },
    // 将每一个切片 并行/串行 的方式发出
    sendQeq() {
    },
    // 发送代码合并请求
    mergeUpload() {
    }
  }
}
</script>
