const express = require('express')
const fs = require("fs")
const multiparty = require("multiparty")
const PORT = 8888
const uploadDir = `${__dirname}/upload`

const app = express()

/**
 * 将上传的文件进行处理
 * @param {*} req 
 * @param {*} res 
 */
function handleUploadFile(req,res,temp) {
    return new Promise((resolve,reject) => {
        const options = {
            maxFieldsSize: 200 * 1024 * 1024
        }
        !temp ? options.uploadDir = uploadDir : null;
        const form = new multiparty.Form(options)
        form.parse(req, function(err, fields, files) {
            if (err) {
                res.send({
                    code: 1,
                    reason: err
                })
                reject(err)
            }
            resolve({
                fields, 
                files
            })
        })
    })
}

app.post('/upload',async (req,res) => {
    const {fields, files} = await handleUploadFile(req,res,true)
    const [filename]  = fields.filename
    const [chunk] = files.chunk

    const hash = /([0-9a-zA-Z]+)_\d+/.exec(filename)[1]

    let path = `${uploadDir}/${hash}`

    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    path = `${path}/${filename}`
    
    fs.access(path, async err => {
        if (!err) {
            res.send({
                code: 0,
                path: path.replace(__dirname,`http://127.0.0.1:${PORT}`)
            })
            return
        }
        await new Promise(resolve => {
            setTimeout(_ => {
                resolve();
            }, 200);
        });

        // 如果没有文件，需要将传过来的文件写入我们的预定位置
        const readStream = fs.createReadStream(chunk.path)
        const  writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on('end', function () {
            fs.unlinkSync(chunk.path);
            res.send({
                code: 0,
                path: path.replace(__dirname, `http://127.0.0.1:${PORT}`)
            });
        });
    })
    
})


app.get('/merge', (req, res) => {
    let {
        hash
    } = req.query;

    let path = `${uploadDir}/${hash}`
    let fileList = fs.readdirSync(path)
    let suffix
    fileList.sort((a, b) => {
        let reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
    }).forEach(item => {
        !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
        fs.appendFileSync(`${uploadDir}/${hash}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        fs.unlinkSync(`${path}/${item}`);
    });
    fs.rmdirSync(path);
    res.send({
        code: 0,
        path: `http://127.0.0.1:${PORT}/upload/${hash}.${suffix}`
    });
});


app.use(express.static('./'));

app.listen(PORT,() => {
    console.log(`serve 端口${PORT}服务启动成功`)
})