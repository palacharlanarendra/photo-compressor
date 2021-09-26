const express = require('express');
const bodyparser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admzip = require('adm-zip');
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const nodemailer = require('nodemailer');
const log = console.log;

const app = express();
const port = process.env.PORT || 5000;
app.use('/uploads', express.static(path.join(__dirname + '/uploads')));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads');
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + '-' + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
});

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/', upload.single('image'), (req, res, next) => {
  const file = req.file;

  var ext;

  if (!file) {
    const error = new Error('Please Upload a file');
    error.httpStatusCode = 404;
    return next(error);
  }
  if (file.mimetype == 'image/jpeg') {
    ext = 'jpg';
  }
  if (file.mimetype == 'image/png') {
    ext = 'png';
  }

  res.render('image', { url: file.path, name: file.filename, ext: ext });
});

app.post('/compress/uploads/:name/:ext', async (req, res) => {
  var recieverMail = req.body.email;
  console.log(req.params.name);
  let yourFilesize = fs.statSync('uploads/' + req.params.name).size;
  var BYTES_PER_KB = 1024;
  var uploadFiles = yourFilesize / BYTES_PER_KB;
  const files = await imagemin(['uploads/' + req.params.name], {
    destination: 'output',
    plugins: [
      imageminJpegtran(),
      imageminPngquant({
        quality: [0.6, 0.8],
      }),
    ],
  });

  res.download(files[0].destinationPath, (err) => {
    console.log(files[0].destinationPath);
    if (err) {
      res.send('Error in downloading zip file');
    } else {
      // Step 1
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: PROCESS.env.mail,
          pass: PROCESS.env.pass,
        },
      });

      // Step 2
      var mailOptions = {
        from: PROCESS.env.mail,
        to: recieverMail,
        subject: 'Download your files',
        text: `Hello user , Here is your compressed file, please find your attachment.
        Uploaded file is ${uploadFiles}KB,
        Compressed file is  ${downloadFiles} KB,
        Your Images are now ${
          ((uploadFiles - downloadFiles) / uploadFiles) * 100
        }% smaller!`,

        attachments: [
          {
            filename: req.params.name,
            content: fs.createReadStream(files[0].destinationPath),
          },
        ],
      };

      // Step 3
      transporter.sendMail(mailOptions, (err, data) => {
        var emailSent = 'Email Successfully Sent!';
        var emailerror = 'Error Occured while Sending Mail!';
        if (err) {
          return log(emailerror);
        }
        return log(emailSent);
      });
    }
  });
  let yourFilesize2 = fs.statSync('output/' + req.params.name).size;
  var BYTES_PER_KB = 1024;
  var downloadFiles = yourFilesize2 / BYTES_PER_KB;
  fs.unlink('uploads/' + req.params.name, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log('upload image deleted');
    }
  });
  setTimeout(function () {
    fs.unlink('output/' + req.params.name, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log('output image deleted');
      }
    });
  }, 10000);
});

app.listen(port, function () {
  console.log(`Server is listening on port ${port}`);
});
