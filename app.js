const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// Models
const UserSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    courses: { type: String, default: '{}' }
});

const CodeSchema = new mongoose.Schema({
    code: String,
    used: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Code = mongoose.model('Code', CodeSchema);

// Session
app.use(session({
    secret: 'medo-platform-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Courses
let courses = [
    { id: "c1", title: "مراجعة الفيزياء - 1 ثانوي", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1636466484362-d26e79aa59d6?w=500" },
    { id: "c2", title: "كيمياء اللغات - 2 ثانوي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1532187875605-2fe358711e24?w=500" }
];

// Helper
function parseCourses(str) {
    if (!str) return {};
    try { return JSON.parse(str); }
    catch { return {}; }
}

// ==================== ROUTES ====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login', { 
        error: req.query.error || null,
        success: req.query.success || null 
    });
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null, success: null });
});

app.post('/signup', async (req, res) => {
    try {
        await User.create(req.body);
        res.redirect('/login?success=تم+إنشاء+الحساب+بنجاح');
    } catch (e) {
        res.render('signup', { error: "الإيميل مسجل مسبقاً!", success: null });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email, password: password });
        
        if (user) {
            req.session.userId = user._id.toString();
            req.session.email = user.email;
            
            if (email === 'admin@medo.com') {
                req.session.isAdmin = true;
                return res.redirect('/admin');
            }
            
            res.redirect('/home');
        } else {
            res.redirect('/login?error=بيانات+الدخول+خاطئة');
        }
    } catch (e) {
        res.redirect('/login?error=حدث+خطأ');
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }
        
        const enrolled = parseCourses(user.courses);
        
        res.render('index', {
            courses: courses,
            enrolledList: enrolled,
            username: user.username,
            sessionId: req.sessionID,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (e) {
        console.log(e);
        res.redirect('/login');
    }
});

// تفعيل كورس - كود واحد فقط!
app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    try {
        const { activationCode } = req.body;
        
        // البحث عن الكود غير المستخدم
        const codeDoc = await Code.findOne({ 
            code: activationCode.trim(), 
            used: false 
        });
        
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/login');
        
        let enrolled = parseCourses(user.courses);
        const courseData = enrolled[req.params.courseId];
        
        // فحص الجهاز
        if (courseData && courseData.device && courseData.device !== req.sessionID) {
            return res.redirect('/home?error=هذا+الكورس+مرتبط+بجهاز+آخر');
        }
        
        if (codeDoc) {
            // تفعيل الكورس ب 3 مشاهدات
            enrolled[req.params.courseId] = { 
                views: 0, 
                max: 3, 
                device: req.sessionID 
            };
            
            await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
            
            // وضع الكود كمستخدم (مش هيقدر يستخدمة تاني)
            codeDoc.used = true;
            await codeDoc.save();
            
            res.redirect('/home?success=تم+التفعيل+3+مشاهدات');
        } else {
            res.redirect('/home?error=الكود+خاطئ+أو+مستخدم+من+قبل');
        }
    } catch (e) {
        console.log(e);
        res.redirect('/home');
    }
});

// ==================== ADMIN ====================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    const students = await User.find({});
    const codes = await Code.find({});
    
    res.render('admin', { 
        students: students, 
        codes: codes, 
        courses: courses,
        error: null, 
        success: null 
    });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    const { title, vid, thumb } = req.body;
    const newId = "c" + (courses.length + 1);
    courses.push({ id: newId, title: title, vid: vid, thumb: thumb });
    
    res.redirect('/admin?success=تم+إضافة+الكورس');
});

// إضافة كود واحد - يشغل أي كورس
app.post('/admin/add-code', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    await Code.create({ code: req.body.newCode.trim() });
    res.redirect('/admin?success=تم+إضافة+الكود');
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

// توليد أكواد - كل كود يُستخدم مرة واحدة فقط
app.get('/admin/generate-keys', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    for (let i = 0; i < 20; i++) {
        let codeVal = "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        await Code.create({ code: codeVal, used: false });
    }
    res.redirect('/admin?success=تم+توليد+20+كود+جديد');
});

// صفحة إضافة أكواد كثيرة
app.get('/admin/add-many-codes/:count', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    const count = parseInt(req.params.count) || 10;
    for (let i = 0; i < count; i++) {
        let codeVal = "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        await Code.create({ code: codeVal, used: false });
    }
    res.redirect('/admin?success=تم+توليد+' + count + '+كود');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log("🚀 Server running on " + PORT));
