const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// الاتصال بقاعدة البيانات
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ متصل بقاعدة البيانات (يوزر + أكواد)"));

// --- الموديلات ---

// 1. موديل المستخدمين
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    role: { type: String, default: 'student' },
    device_info: { type: String, default: "" },
    is_active: { type: Boolean, default: false }
}));

// 2. موديل الأكواد (موجود عندك في القاعدة)
const Code = mongoose.model('Code', new mongoose.Schema({
    codeText: { type: String, unique: true },
    isUsed: { type: Boolean, default: false }
}));

// 3. موديل الكورسات (ديناميكي)
const Course = mongoose.model('Course', new mongoose.Schema({
    title: String,
    vid: String,
    thumb: String
}));

app.use(session({ 
    secret: 'medo-platform-pro-2026', 
    resave: false, 
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- المسارات ---

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: req.query.error || null, success: req.query.success || null }));

app.get('/register', (req, res) => res.render('register', { error: req.query.error || null }));

app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        await User.create({ username, email, password });
        res.redirect('/login?success=تم إنشاء حسابك، سجل دخولك الآن');
    } catch (e) { res.redirect('/register?error=الإيميل موجود مسبقاً'); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        const currentDevice = req.headers['user-agent'];
        if (user.device_info && user.device_info !== currentDevice && user.role !== 'admin') {
            return res.redirect('/login?error=الحساب مسجل على جهاز آخر');
        }
        if (!user.device_info) await User.findByIdAndUpdate(user._id, { device_info: currentDevice });
        
        if (email === "medo_elkber@gmail.com") {
            await User.findByIdAndUpdate(user._id, { role: 'admin' });
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/home');
    }
    res.redirect('/login?error=خطأ في بيانات الدخول');
});

// تفعيل الحساب باستخدام الأكواد من الداتا بيز
app.post('/activate', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { code } = req.body;
    const foundCode = await Code.findOne({ codeText: code, isUsed: false });

    if (foundCode) {
        await User.findByIdAndUpdate(req.session.userId, { is_active: true });
        await Code.findByIdAndUpdate(foundCode._id, { isUsed: true });
        res.redirect('/home?success=تم التفعيل بنجاح! شاهد الكورسات الآن');
    } else {
        res.redirect('/home?error=الكود غير صحيح أو تم استخدامه');
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const courses = await Course.find();
    res.render('index', { user, courses, error: req.query.error, success: req.query.success });
});

app.get('/course/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (!user.is_active && user.role !== 'admin') return res.redirect('/home?error=يجب تفعيل المنصة أولاً');
    const course = await Course.findById(req.params.id);
    res.render('video', { course });
});

// --- لوحة التحكم (الأدمن) ---
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.role !== 'admin') return res.redirect('/home');
    
    const students = await User.find({ role: 'student' });
    const courses = await Course.find();
    const codes = await Code.find();
    res.render('admin', { students, courses, codes });
});

app.post('/admin/add-course', async (req, res) => {
    await Course.create(req.body);
    res.redirect('/admin/dashboard');
});

app.post('/admin/add-code', async (req, res) => {
    await Code.create({ codeText: req.body.newCode });
    res.redirect('/admin/dashboard');
});

app.get('/admin/delete-student/:id', async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

app.get('/admin/reset-student/:id', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { device_info: "" });
    res.redirect('/admin/dashboard');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(3000);
module.exports = app;
