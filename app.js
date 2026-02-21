const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// User Model - تخزين بسيط
const UserSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    courses: { type: String, default: '{}' }
});

const CodeSchema = new mongoose.Schema({
    code: String,
    course_id: String,
    used: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Code = mongoose.model('Code', CodeSchema);

// Session
app.use(session({
    secret: 'medo-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Courses
const courses = [
    { id: "c1", title: "مراجعة الفيزياء - 1 ثانوي", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1636466484362-d26e79aa59d6?w=500" },
    { id: "c2", title: "كيمياء اللغات - 2 ثانوي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1532187875605-2fe358711e24?w=500" }
]);

// Helper
function getCourses(user) {
    try { return JSON.parse(user.courses || '{}'); }
    catch { return {}; }
}

// Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login', { error: null, success: null });
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null, success: null });
});

app.post('/signup', async (req, res) => {
    try {
        await User.create(req.body);
        res.render('login', { error: null, success: "✅ تم إنشاء الحساب!" });
    } catch (e) {
        res.render('signup', { error: "الإيميل مسجل!", success: null });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    
    if (user) {
        req.session.userId = user._id;
        if (email === 'admin@medo.com') {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        res.redirect('/home');
    } else {
        res.render('login', { error: "بيانات خاطئة", success: null });
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');
    
    const enrolled = getCourses(user);
    
    res.render('index', {
        courses,
        enrolledList: enrolled,
        username: user.username,
        error: null,
        success: null
    });
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, used: false });
    const user = await User.findById(req.session.userId);
    
    let enrolled = getCourses(user);
    
    if (codeDoc) {
        enrolled[req.params.courseId] = { views: 0, max: 3, device: req.sessionID };
        await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
        
        codeDoc.used = true;
        await codeDoc.save();
        
        res.render('index', {
            courses,
            enrolledList: enrolled,
            username: user.username,
            error: null,
            success: "✅ تم التفعيل! 3 مشاهدات"
        });
    } else {
        res.render('index', {
            courses,
            enrolledList: enrolled,
            username: user.username,
            error: "❌ كود خطأ",
            success: null
        });
    }
});

// Admin
app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    const students = await User.find({});
    const codes = await Code.find({});
    
    res.render('admin', { students, codes, error: null, success: null });
});

app.post('/admin/add-code', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    await Code.create({ code: req.body.newCode, course_id: req.body.courseId });
    
    res.redirect('/admin');
});

app.get('/admin/delete-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
