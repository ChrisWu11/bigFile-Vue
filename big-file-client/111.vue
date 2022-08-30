<template>
    <div class="myDiv">
        <el-upload class="upload-demo" action="#" :on-change="uploadFile" :show-file-list="true" :file-list="fileList" :auto-upload="false" ref="uploadfile" :limit="1">
            <el-button size="small" type="primary" :loading="loadingFile">上传文件</el-button>
        </el-upload>
    </div>
</template>
 
<script>
import SparkMD5 from "spark-md5";
const chunkSize = 10 * 1024 * 1024;//定义分片的大小 暂定为10M，方便测试
import { message_s, message_w } from '@/methods/element';//引入elementui消息提示框
export default {
    name: '',
    components: {},
    props: {},
    data() {
        return {
            fileList: [],
            loadingFile: false
        }
    },
    watch: {},
    computed: {},
    methods: {
        /**
         * 上传文件
         */
        async uploadFile(File) {
            this.loadingFile = true
            var self = this
            //获取用户选择的文件
            const file = File.raw
            this.currentFile = file
            //文件大小(大于100m再分片哦，否则直接走普通文件上传的逻辑就可以了，这里只实现分片上传逻辑)
            const fileSize = File.size
            // 放入文件列表
            this.fileList = [{ "name": File.name }]
            // 可以设置大于多少兆可以分片上传，否则走普通上传
            if (fileSize <= chunkSize) {
                console.log("上传的文件大于10m才能分片上传")
            }
            //计算当前选择文件需要的分片数量
            const chunkCount = Math.ceil(fileSize / chunkSize)
            console.log("文件大小：", (File.size / 1024 / 1024) + "Mb", "分片数：", chunkCount)
            //获取文件md5
            const fileMd5 = await this.getFileMd5(file, chunkCount);
            console.log("文件md5：", fileMd5)
 
            console.log("向后端请求本次分片上传初始化")
 
            const initUploadParams = {
                "identifier": fileMd5, //文件的md5
                "filename": File.name, //文件名
                "totalChunks": chunkCount, //分片的总数量
            }
            // 调用后端检查文件上传情况接口
            this.service("/upload/checkChunkExist", 'post', initUploadParams, async (res) => {
                //分片上传成功且未合并，那就调用合并接口
                if (res.data.allUploadSuccess === true && res.data.mergeSuccess == false) {
                    console.log("当前文件上传情况：所有分片已在之前上传完成，仅需合并")
                    self.composeFile(fileMd5, File.name, chunkCount)
                    self.storeBucket = ""
                    self.loadingFile = false
                    return false;
                }
                // 所有分片上传成功且合并成功，直接秒传
                if (res.data.allUploadSuccess === true && res.data.mergeSuccess === true) {
                    console.log("当前文件上传情况：秒传")
                    self.loadingFile = false
                    message_s("上传成功")
                    self.fileList = []
                    self.$refs.upload.clearFiles()
                    return false;
                }
                // 获取后端返回的已上传分片数字的数组
                var uploaded = res.data.uploaded
                // 定义分片开始上传的序号
                // 由于是顺序上传，可以判断后端返回的分片数组的长度，为0则说明文件是第一次上传，分片开始序号从0开始
                // 如果分片数组的长度不为0，我们取最后一个序号作为开始序号
                var num = uploaded.length == 0 ? 0 : uploaded[uploaded.length - 1]
                console.log(num, '分片开始序号')
                // 当前为顺序上传方式，若要测试并发上传，请将103 行 await 修饰符删除即可
                // 循环调用上传
                for (var i = num; i < chunkCount; i++) {
                    //分片开始位置
                    let start = i * chunkSize
                    //分片结束位置
                    let end = Math.min(fileSize, start + chunkSize)
                    //取文件指定范围内的byte，从而得到分片数据
                    console.log(File, '0000')
                    let _chunkFile = File.raw.slice(start, end)
                    console.log(_chunkFile)
                    console.log("开始上传第" + i + "个分片")
                    let formdata = new FormData()
                    formdata.append('identifier', fileMd5)
                    formdata.append('filename', File.name)
                    formdata.append('totalChunks', chunkCount)
                    formdata.append('chunkNumber', i)
                    formdata.append('totalSize', fileSize)
                    formdata.append('file', _chunkFile)
 
                    // 通过await实现顺序上传
                    await this.getMethods(formdata)
                }
                // 文件上传完毕，请求后端合并文件并传入参数
                self.composeFile(fileMd5, File.name, chunkCount)
            })
        },
        /**
         * 上传文件方法
         * @param formdata 上传文件的参数
         */
        getMethods(formdata) {
            return new Promise((resolve, reject) => {
                this.service("/upload/chunk", 'post', formdata, (res) => {
                    console.log(res)
                    resolve();
                })
            });
        },
        /**
      * 获取文件MD5
      * @param file
      * @returns {Promise<unknown>}
      */
        getFileMd5(file, chunkCount) {
            return new Promise((resolve, reject) => {
                let blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
                let chunks = chunkCount;
                let currentChunk = 0;
                let spark = new SparkMD5.ArrayBuffer();
                let fileReader = new FileReader();
 
                fileReader.onload = function (e) {
                    spark.append(e.target.result);
                    currentChunk++;
                    if (currentChunk < chunks) {
                        loadNext();
                    } else {
                        let md5 = spark.end();
                        resolve(md5);
                    }
                };
                fileReader.onerror = function (e) {
                    reject(e);
                };
                function loadNext() {
                    let start = currentChunk * chunkSize;
                    let end = start + chunkSize;
                    if (end > file.size) {
                        end = file.size;
                    }
                    fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
                }
                loadNext();
            });
        },
        /**
         * 请求后端合并文件
         * @param fileMd5 文件md5
         * @param fileName 文件名称
         * @param count 文件分片总数
         */
        composeFile(fileMd5, fileName, count) {
            console.log("开始请求后端合并文件")
            var data = {
                "identifier": fileMd5, //文件的md5
                "filename": fileName, //文件名
                "totalChunks": count //分片的总数量
            }
            this.service('/upload/merge', 'post', data, (data) => {
                if (data.successful == true) {
                    message_s(data.message)
                    this.loadingFile = false
                    this.$refs.upload.clearFiles()
                } else {
                    this.loadingFile = false
                    message_w(data.message)
                }
            })
        },
    },
    created() { },
    mounted() { }
}
</script>
<style lang="less" scoped>
</style>