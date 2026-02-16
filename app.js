const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// إعدادات المحرك (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// إعدادات البيانات والملفات العامة
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// رابط الداتا بيز بالباسورد بتاعك (تأكد إنه medoelkber2025)
const dbURI = "mongodb+srv://medoelkber2:medoelkber2025@cluster0.o8905.mongodb.net/medo-school?retryWrites=true&w=majority";

mongoose.connect(dbURI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.log('❌ MongoDB Error:', err));

// المسارات (Routes) - ركز هنا عشان ده حل الـ ReferenceError
app.get('/', (req, res) => {
    // بنبعت قيم افتراضية عشان الـ EJS ميعملش Error لو السطر 6 فيه user أو title
    res.render('index', { 
        user: null, 
        title: "الصفحة الرئيسية",
        error: null 
    }); 
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server ready on port ${PORT}`);
});

module.exports = app;
