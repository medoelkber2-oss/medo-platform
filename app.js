const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// إعدادات المحرك (EJS) وتحديد مكان الفولدر بشكل صحيح
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// إعدادات التعامل مع البيانات القادمة من الفورم
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// رابط الداتا بيز بالباسورد بتاعك
const dbURI = "mongodb+srv://medoelkber2:medoelkber2025@cluster0.o8905.mongodb.net/medo-school?retryWrites=true&w=majority";

mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB Successfully!'))
  .catch((err) => console.log('MongoDB Connection Error:', err));

// المسارات (Routes) - تم التعديل لمنع الـ ReferenceError
app.get('/', (req, res) => {
    // ضفنا قيم افتراضية عشان الـ EJS ميعطلش
    res.render('index', { user: null, title: "Home" }); 
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

// مسار افتراضي لأي صفحة تانية (Page Not Found)
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// تشغيل السيرفر بشكل مرن
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
