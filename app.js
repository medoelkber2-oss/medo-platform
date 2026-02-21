const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

// إعدادات المحرك
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Middleware لتوليد device ID من الـ session
app.use((req, res, next) => {
    if (!req.session.deviceId) {
        req.session.deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    req.deviceId = req.session.deviceId;
    next();
});

// الربط بالداتا بيز
const mongoURI = (process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority").trim();

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected Successfully"))
    .catch(err => console.error("❌ DB Error:", err));

// جداول البيانات
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    enrolled_courses: {
        type: Map,
        of: {
            activated: { type: Boolean, default: true },
            views: { type: Number, default: 0 },
            max_views: { type: Number, default: 3 },
            device_id: { type: String, default: null }
        },
        default: {}
    }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true },
    course_id: String,
    is_used: { type: Boolean, default: false }
}));

app.use(session({
    secret: 'medo-platform-secret-2026',
    resave: false,
    saveUninitialized: true
}));

// قائمة الكورسات
let courses = [
    { id: "c1", title: "مراجعة الفيزياء - 1 ثانوي", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1636466484362-d26e79aa59d6?w=500" },
    { id: "c2", title: "كيمياء اللغات - 2 ثانوي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1532187875605-2fe358711e24?w=500" }
];

// ==================== المسارات ====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { 
    error: null,
    success: null
}));

app.get('/signup', (req, res) => res.render('signup', { 
    error: null,
    success: null
}));

app.post('/signup', async (req, res) => {
    try { 
        await User.create(req.body); 
        res.render('login', { 
            error: null, 
            success: "✅ تم إنشاء الحساب بنجاح! سجل دخول الآن" 
        });
    }
    catch (e) { 
        res.render('signup', { 
            error: "الإيميل مسجل مسبقاً",
            success: null
        }); 
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
    }
    else { 
        res.render('login', { 
            error: "بيانات الدخول خاطئة",
            success: null
        }); 
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    
    let enrolledObj = {};
    if (user.enrolled_courses) {
        user.enrolled_courses.forEach((value, key) => {
            enrolledObj[key] = value;
        });
    }
    
    res.render('index', { 
        courses, 
        enrolledList: enrolledObj, 
        username: user.username,
        deviceId: req.deviceId,
        error: null,
        success: null
    });
});

// تفعيل كورس
app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    const user = await User.findById(req.session.userId);
    
    let enrolledObj = {};
    if (user.enrolled_courses) {
        user.enrolled_courses.forEach((value, key) => {
            enrolledObj[key] = value;
        });
    }
    
    const courseData = enrolledObj[req.params.courseId];
    
    // فحص إذا كان مرتبط بجهاز آخر
    if (courseData && courseData.device_id && courseData.device_id !== req.deviceId) {
        return res.render('index', { 
            courses, 
            enrolledList: enrolledObj, 
            username: user.username,
            deviceId: req.deviceId,
            error: "❌ هذا الكورس مرتبط بجهاز آخر! يرجى التفعيل من جهازك الأصلي",
            success: null
        });
    }
    
    if (codeDoc) {
        if (!enrolledObj[req.params.courseId]) {
            enrolledObj[req.params.courseId] = {
                activated: true,
                views: 0,
                max_views: 3,
                device_id: req.deviceId
            };
        } else {
            enrolledObj[req.params.courseId] = {
                activated: true,
                views: 0,
                max_views: 3,
                device_id: req.deviceId
            };
        }
        
        await User.findByIdAndUpdate(req.session.userId, {
            enrolled_courses: enrolledObj
        });
        
        codeDoc.is_used = true;
        await codeDoc.save();
        
        const updatedUser = await User.findById(req.session.userId);
        let updatedEnrolled = {};
        if (updatedUser.enrolled_courses) {
            updatedUser.enrolled_courses.forEach((value, key) => {
                updatedEnrolled[key] = value;
            });
        }
        
        return res.render('index', { 
            courses, 
            enrolledList: updatedEnrolled, 
            username: updatedUser.username,
            deviceId: req.deviceId,
            error: null,
            success: "✅ مبروك! الكورس اتفعل عندك (مرتبط بجهازك - 3 مشاهدات)"
        });
    } else {
        return res.render('index', { 
            courses, 
            enrolledList: enrolledObj, 
            username: user.username,
            deviceId: req.deviceId,
            error: "❌ الكود غلط أو مستخدم",
            success: null
        });
    }
});

// ==================== لوحة الأدمن ====================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const students = await User.find({});
    const codes = await Code.find({});
    res.render('admin', { 
        students, 
        codes,
        error: null,
        success: null
    });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    const newId = "c" + (courses.length + 1);
    courses.push({ id: newId, title, vid, thumb });
    
    const students = await User.find({});
    const codes = await Code.find({});
    res.render('admin', { 
        students, 
        codes,
        error: null,
        success: "✅ تم إضافة الكورس بنجاح!"
    });
});

app.post('/admin/add-code', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { newCode, courseId } = req.body;
    try {
        await Code.create({ code: newCode, course_id: courseId });
        
        const students = await User.find({});
        const codes = await Code.find({});
        res.render('admin', { 
            students, 
            codes,
            error: null,
            success: "✅ تم إضافة الكود بنجاح!"
        });
    } catch (e) {
        const students = await User.find({});
        const codes = await Code.find({});
        res.render('admin', { 
            students, 
            codes,
            error: "❌ الكود موجود بالفعل!",
            success: null
        });
    }
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

app.get('/admin/generate-keys-secret', async (req, res) => {
    const ids = ["c1", "c2"];
    for (let id of ids) {
        for (let i = 0; i < 10; i++) {
            let codeVal = `MEDO-${Math.random().toString(36).substring(5).toUpperCase()}`;
            await Code.create({ code: codeVal, course_id: id });
        }
    }
    res.send("✅ تم توليد 20 كود جديد بنجاح!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 السيرفر شغال الآن على بورت ${PORT}`));
