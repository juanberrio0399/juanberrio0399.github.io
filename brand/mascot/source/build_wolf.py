"""Builds the wolf character in Blender: sculpted and remeshed shapes, painted colours, a pivot
hierarchy for animation, a GLB export and preview renders.

Run:  blender --background --python build_wolf.py -- <out_dir> [render]

Geometry is written in "stage" coordinates (x right, y up, z towards the viewer) and converted to
Blender's (x, -z, y) when the mesh is created, so it matches the web viewer one to one.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
RENDER = "render" in sys.argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


# ---------------------------------------------------------------- helpers
def lin(hexv):
    c = [((hexv >> s) & 255) / 255 for s in (16, 8, 0)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def conv(p):
    return Vector((p[0], -p[2], p[1]))


def sm(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def bump(d, cx, cy, cz, w, kx=1.0):
    n = math.sqrt(cx * cx + cy * cy + cz * cz)
    dx, dy, dz = (d.x - cx / n) * kx, d.y - cy / n, d.z - cz / n
    return math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * w * w))


def T(x=0, y=0, z=0):
    return Matrix.Translation((x, y, z))


def R(x=0, y=0, z=0):
    return Euler((x, y, z), "ZYX").to_matrix().to_4x4()   # same order as three.js 'XYZ'


def S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal((x, y, z, 1))


I = Matrix.Identity(4)


def sculpt(bm, fn, m=I, seg=64):
    """Adds a sphere whose every vertex is moved to fn(direction). Poles are on the y axis."""
    ret = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg * 2 // 3), radius=1.0)
    for v in ret["verts"]:
        d = Vector((v.co.x, v.co.z, -v.co.y)).normalized()
        v.co = m @ Vector(fn(d))
    return ret["verts"]


def ball(bm, r, m=I, seg=40):
    return sculpt(bm, lambda d: d * r, m, seg)


def spike(bm, r, h, m=I, flat=1.0, bend=0.0, seg=40, tip=0.75):
    """A rounded cone standing on y = 0 with its tip at y = h."""
    def fn(d):
        t = (d.y + 1) / 2
        w = r * (1 - t) ** tip * (1 + 0.15 * math.sin(math.pi * t))
        return (d.x * w + bend * t * t, t * h - 0.25 * r * (1 - t) ** 3, d.z * w * flat)
    return sculpt(bm, fn, m, seg)


def limb(bm, r0, r1, length, m=I, seg=40):
    """A tapered capsule hanging down from the origin."""
    def fn(d):
        top = d.y > 0
        rad = r0 if top else r1
        return (d.x * rad, d.y * rad - (0 if top else length), d.z * rad)
    return sculpt(bm, fn, m, seg)


def torus(bm, big, small, m=I, arc=math.tau, seg=64, ring=16, sy=1.0):
    """A torus around the y axis (lying flat)."""
    closed = abs(arc - math.tau) < 1e-6
    n = seg if closed else seg + 1
    rows = []
    for i in range(n):
        a = arc * i / seg
        row = []
        for j in range(ring):
            b = math.tau * j / ring
            rr = big + small * math.cos(b)
            row.append(bm.verts.new(m @ Vector((rr * math.cos(a), small * math.sin(b) * sy, rr * math.sin(a)))))
        rows.append(row)
    for i in range(n - (0 if closed else 1)):
        a, b = rows[i], rows[(i + 1) % n]
        for j in range(ring):
            bm.faces.new((a[j], a[(j + 1) % ring], b[(j + 1) % ring], b[j]))
    if not closed:
        bm.faces.new(rows[0]); bm.faces.new(list(reversed(rows[-1])))


def tube(bm, pts, r, m=I, ring=10, steps=24):
    """A round tube along a smooth curve through the points."""
    pts = [Vector(p) for p in pts]
    path = []
    for i in range(steps + 1):
        f = i / steps * (len(pts) - 1)
        k = min(int(f), len(pts) - 2)
        t = f - k
        p0, p1, p2, p3 = pts[max(k - 1, 0)], pts[k], pts[k + 1], pts[min(k + 2, len(pts) - 1)]
        path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    rows = []
    for i, p in enumerate(path):
        tan = (path[min(i + 1, steps)] - path[max(i - 1, 0)]).normalized()
        up = Vector((0, 1, 0)) if abs(tan.y) < 0.9 else Vector((1, 0, 0))
        a = tan.cross(up).normalized(); b = tan.cross(a)
        rows.append([bm.verts.new(m @ (p + (a * math.cos(math.tau * j / ring) + b * math.sin(math.tau * j / ring)) * r)) for j in range(ring)])
    for i in range(steps):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % ring], rows[i + 1][(j + 1) % ring], rows[i + 1][j]))
    bm.faces.new(rows[0]); bm.faces.new(list(reversed(rows[-1])))


def node(name, parent=None, pos=(0, 0, 0), yaw=0.0):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.05
    col.objects.link(o)
    o.parent = parent
    o.location = conv(pos)
    o.rotation_euler = (0, 0, yaw)
    return o


def make(name, bm, parent, mat, smooth=True):
    """Turns stage-space geometry into a Blender mesh object under a pivot."""
    for v in bm.verts:
        v.co = conv(v.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.parent = parent
    me.materials.append(mat)
    return o


def remesh(o, voxel, smooth_iter=6, factor=0.8):
    """Fuses overlapping shapes into one clean surface and softens it."""
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    m = o.modifiers.new("fuse", "REMESH"); m.mode = "VOXEL"; m.voxel_size = voxel; m.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier="fuse")
    if smooth_iter:
        m = o.modifiers.new("soft", "SMOOTH"); m.factor = factor; m.iterations = smooth_iter
        bpy.ops.object.modifier_apply(modifier="soft")
    o.select_set(False)
    for p in o.data.polygons:
        p.use_smooth = True


def paint(o, fn):
    """Vertex colours from a function of the stage-space position."""
    me = o.data
    ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    for i, v in enumerate(me.vertices):
        ca.data[i].color = (*fn(Vector((v.co.x, v.co.z, -v.co.y))), 1.0)
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = 0


def material(name, color=None, rough=0.6, sheen=0.0, sheen_tint=0xffffff, coat=0.0, emit=None, emit_k=0.0, vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    if vcol:
        n = m.node_tree.nodes.new("ShaderNodeVertexColor"); n.layer_name = "Col"
        m.node_tree.links.new(n.outputs["Color"], b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (*lin(color), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Tint"].default_value = (*lin(sheen_tint), 1)
    b.inputs["Sheen Roughness"].default_value = 0.45
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.15
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*lin(emit), 1)
        b.inputs["Emission Strength"].default_value = emit_k
    return m


FUR, FURD, WHITE, EAR = lin(0x2C62A0), lin(0x173B63), lin(0xE9F1F8), lin(0x1FB6CF)
M = {
    "skin": material("fur", rough=0.72, sheen=0.3, sheen_tint=0x9cc8ee, vcol=True),
    "fur": material("fur_plain", 0x2C62A0, 0.72, 0.3, 0x9cc8ee),
    "hood": material("hoodie", 0x17344F, 0.9, 0.5, 0x5f95c6),
    "pants": material("pants", 0x0D2236, 0.92, 0.35, 0x3f6c96),
    "green": material("green", 0x22C55E, 0.8, 0.4, 0xbbf7d0),
    "white": material("white", 0xE9F1F8, 0.7, 0.3),
    "ink": material("ink", 0x07131E, 0.15, coat=1.0),
    "gloss": material("gloss", 0xEEF3F8, 0.2, coat=1.0),
    "rubber": material("rubber", 0x22303D, 0.9),
    "eye": material("eye", 0xFFFFFF, 0.1, coat=1.0),
    "iris": material("iris", 0x22D3EE, 0.12, coat=1.0, emit=0x0E7490, emit_k=1.0),
    "cyan": material("light", 0x22D3EE, 0.3, emit=0x22D3EE, emit_k=6.0),
}


def mix(a, b, t):
    return [a[i] + (b[i] - a[i]) * t for i in range(3)]


# ---------------------------------------------------------------- head
def head_shape(d):
    r = 1.0
    r += 0.5 * bump(d, 0, -0.26, 0.96, 0.3, 1.25)                                              # muzzle
    r += 0.2 * (bump(d, 0.86, -0.46, 0.22, 0.34) + bump(d, -0.86, -0.46, 0.22, 0.34))          # cheeks
    r += 0.06 * (bump(d, 0.4, 0.34, 0.85, 0.22) + bump(d, -0.4, 0.34, 0.85, 0.22))             # brow ridge
    r -= 0.04 * (bump(d, 0.36, 0.06, 0.93, 0.16) + bump(d, -0.36, 0.06, 0.93, 0.16))           # eye sockets
    r *= 1 - 0.16 * sm(0.45, 1, -d.y) * (1 - bump(d, 0, -0.26, 0.96, 0.4))                     # jaw
    return Vector((d.x * 0.6 * r, d.y * 0.52 * r, d.z * 0.54 * r))


def hp(x, y, z, k=1.0):
    return head_shape(Vector((x, y, z)).normalized()) * k


EARS = [T(s * 0.34, 0.36, -0.08) @ R(-0.1, 0, -s * 0.36) for s in (-1, 1)]


def head_paint(p):
    ear = 0.0                                                                                   # inside of the ears, soft edge
    for m in EARS:
        q = m.inverted() @ p
        t = q.y / 0.62
        if 0.05 < t < 0.9:
            k = sm(0.0, 0.03, 0.125 * (1 - t) ** 0.8 - abs(q.x)) * sm(0.08, 0.16, t) * sm(0.84, 0.74, t) * sm(0.0, 0.03, q.z)
            if k > ear:
                ear, ear_c = k, mix(EAR, FURD, sm(0.5, 0.05, t) * 0.6)
    d = p.normalized()
    muzzle = bump(d, 0, -0.26, 0.96, 0.3, 1.25)
    w = sm(0.0, 0.14, -d.y - 0.1 + 0.3 * max(0.0, d.z)) * sm(-0.25, 0.15, d.z)
    w = max(w * sm(0.12, 0.3, abs(d.x) + (-d.y - 0.1) * 1.4), sm(0.3, 0.55, muzzle))
    w *= sm(0.9, 0.7, abs(d.x)) * sm(0.78, 0.66, p.length / 1.0 if abs(p.x) > 0.55 else 0)
    stripe = sm(0.2, 0.06, abs(d.x)) * sm(0.05, 0.3, d.y) * sm(-0.3, 0.3, d.z)
    c = mix(FUR, FURD, max(stripe * 0.85, sm(0.1, -0.9, d.z) * 0.55))
    if p.y > 0.46 and abs(p.x) < 0.2 and p.z > -0.05:                                           # quiff
        c = mix(c, FURD, 0.8)
    c = mix(c, WHITE, w)
    return mix(c, ear_c, ear) if ear > 0 else c


wolf = node("wolf")
body = node("body", wolf)
head = node("head", body, (0, 1.92, 0.03))

bm = bmesh.new()
sculpt(bm, head_shape, seg=96)
for m in EARS:                                                                                  # ears, slightly cupped
    spike(bm, 0.2, 0.62, m, flat=0.58, tip=0.62)
for s in (-1, 1):                                                                               # cheek fur
    for (x, y, z, rz, r, h, tp) in ((0.42, 0.09, -0.02, 1.4, 0.18, 0.25, 0.38), (0.45, -0.03, 0.02, 1.78, 0.24, 0.36, 0.4),
                                    (0.44, -0.17, 0.0, 2.05, 0.19, 0.28, 0.36), (0.41, -0.26, 0.06, 2.3, 0.22, 0.33, 0.4),
                                    (0.33, -0.35, 0.05, 2.65, 0.16, 0.22, 0.36)):
        spike(bm, r, h, T(s * x, y, z) @ R(0, 0, -s * rz), flat=0.88, bend=-0.07, tip=tp)
spike(bm, 0.13, 0.34, T(-0.02, 0.44, 0.16) @ R(0.95, 0.0, -0.45), flat=0.8, bend=0.1)          # quiff
spike(bm, 0.1, 0.24, T(-0.1, 0.45, 0.14) @ R(0.8, 0.0, 0.1), flat=0.8)
head_o = make("head_mesh", bm, head, M["skin"])
remesh(head_o, 0.0095, 4, 0.7)
paint(head_o, head_paint)

# nose, mouth, fang
bm = bmesh.new()
sculpt(bm, lambda d: (d.x * 0.105 * (1 - 0.25 * sm(0, 1, -d.y)), d.y * 0.07, d.z * 0.075), T(*hp(0, -0.17, 0.985)) @ R(-0.25))
tube(bm, [hp(-0.17, -0.47, 0.86, 0.993), hp(-0.07, -0.51, 0.85, 0.993), hp(0, -0.495, 0.86, 0.993), hp(0.12, -0.525, 0.84, 0.993), hp(0.25, -0.47, 0.84, 0.993), hp(0.33, -0.39, 0.86, 0.992)], 0.0085)
tube(bm, [hp(0, -0.3, 0.95, 0.985), hp(0, -0.4, 0.9, 0.992), hp(0, -0.495, 0.86, 0.993)], 0.0065, steps=8)
make("face_ink", bm, head, M["ink"])
bm = bmesh.new()
spike(bm, 0.02, 0.06, T(*hp(0.21, -0.5, 0.84, 0.99)) @ R(math.pi))
make("fang", bm, head, M["gloss"])

# eyes: ball, iris, pupil, glint, lid (its own pivot, so it can blink), brow
for s, tag in ((-1, "L"), (1, "R")):
    e = node("eye" + tag, head, hp(s * 0.36, 0.06, 0.93, 0.97), yaw=s * 0.36)
    bm = bmesh.new(); ball(bm, 0.125, S(1.12, 0.92, 0.75)); make("eyeball" + tag, bm, e, M["eye"])
    bm = bmesh.new(); ball(bm, 0.08, T(-s * 0.012, -0.006, 0.066) @ S(1, 1, 0.5)); make("iris" + tag, bm, e, M["iris"])
    bm = bmesh.new(); ball(bm, 0.04, T(-s * 0.012, -0.006, 0.09) @ S(1, 1, 0.5)); ball(bm, 0.04, T(s * 0.015, 0.2 if s > 0 else 0.165, 0.07) @ R(0, 0, 0.42 if s > 0 else -0.3) @ S(3.5, 0.7, 0.9))
    make("pupil" + tag, bm, e, M["ink"])
    bm = bmesh.new(); ball(bm, 0.016, T(-s * 0.045, 0.026, 0.106), 16); make("glint" + tag, bm, e, M["eye"])
    lid = node("lid" + tag, e)
    bm = bmesh.new()
    ball(bm, 0.1285, S(1.12, 0.92, 0.76), 64)
    cut = (R(-0.35, 0, -s * 0.3) @ Vector((0, 1, 0, 0))).xyz.normalized()
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=cut * 0.054, plane_no=cut, clear_inner=True)
    make("lid_mesh" + tag, bm, lid, M["fur"])

# ---------------------------------------------------------------- torso
torso = node("torso", body, (0, 1.0, 0))
bm = bmesh.new()


def torso_shape(d):
    y = d.y
    r = 0.385 + 0.04 * bump(Vector((0, y, 0)), 0, 0.55, 0, 0.25) - 0.02 * sm(0.2, -0.6, y)
    r *= (1 - sm(0.55, 1.0, y) * 0.62) * (1 - sm(-0.8, -1.0, y) * 0.25)
    return (d.x * r * (1 + 0.16 * sm(0.0, 0.5, y) * sm(1.0, 0.5, y)), -0.02 + y * 0.56, d.z * r * 0.76)


sculpt(bm, torso_shape, seg=80)
torus(bm, 0.335, 0.036, T(0, -0.49, 0) @ S(1, 1, 0.76))                                          # hem
sculpt(bm, lambda d: (d.x * 0.27, d.y * 0.13 * (1 + 0.2 * d.x * d.x), d.z * 0.075), T(0, -0.22, 0.25) @ R(-0.12))   # pocket
sculpt(bm, lambda d: (d.x * 0.36, d.y * 0.2 * (1 - 0.3 * sm(0, 1, -d.y)), d.z * 0.27), T(0, 0.47, -0.2) @ R(0.35))   # hood
torso_o = make("hoodie", bm, torso, M["hood"])
remesh(torso_o, 0.012, 4, 0.6)
bm = bmesh.new(); torus(bm, 0.2, 0.07, T(0, 0.5, 0.03) @ R(-0.2) @ S(1.05, 1, 0.95)); make("collar", bm, torso, M["green"])
bm = bmesh.new()
for s in (-1, 1):
    tube(bm, [(s * 0.07, 0.42, 0.25), (s * 0.085, 0.3, 0.3), (s * 0.09, 0.14, 0.305), (s * 0.085, 0.02, 0.3)], 0.013)
make("strings", bm, torso, M["white"])
bm = bmesh.new()
for s in (-1, 1):
    limb(bm, 0.019, 0.019, 0.04, T(s * 0.085, 0.02, 0.3), 16)
make("aglets", bm, torso, M["gloss"])
bm = bmesh.new()
for i, (x, h) in enumerate(((0.17, 0.05), (0.205, 0.08), (0.24, 0.11))):
    limb(bm, 0.012, 0.012, h, T(x, 0.2 + h, 0.268 - i * 0.012), 16)
make("patch", bm, torso, M["cyan"])
bm = bmesh.new(); ball(bm, 0.017, T(0.268, 0.36, 0.222), 16); make("patch_dot", bm, torso, M["green"])

# headphones around the neck
phones = node("phones", body, (0, 1.47, 0))
bm = bmesh.new()
torus(bm, 0.27, 0.034, R(0.25, math.pi, 0), arc=math.pi)
for s in (-1, 1):
    m = T(s * 0.3, -0.05, 0.1) @ R(0.2, s * 0.5, 0)
    sculpt(bm, lambda d: (d.x * 0.06 * (1 + 0.35 * (1 - d.x * d.x)), d.y * 0.125, d.z * 0.125), m, 48)
make("phones_shell", bm, phones, M["gloss"])
bm = bmesh.new()
for s in (-1, 1):
    torus(bm, 0.1, 0.036, T(s * 0.3, -0.05, 0.1) @ R(0.2, s * 0.5, 0) @ T(-s * 0.05, 0, 0) @ R(0, 0, math.pi / 2), ring=12)
make("phones_pad", bm, phones, M["rubber"])
bm = bmesh.new()
for s in (-1, 1):
    torus(bm, 0.06, 0.012, T(s * 0.3, -0.05, 0.1) @ R(0.2, s * 0.5, 0) @ T(s * 0.066, 0, 0) @ R(0, 0, math.pi / 2), seg=40, ring=10)
make("phones_light", bm, phones, M["cyan"])

# ---------------------------------------------------------------- arms
for s, tag in ((-1, "L"), (1, "R")):
    tilt = R(0, 0, s * 0.2)
    sh = node("sh" + tag, body, (s * 0.41, 1.3, 0))
    bm = bmesh.new(); limb(bm, 0.125, 0.108, 0.27, tilt); make("arm_up" + tag, bm, sh, M["hood"])
    el = node("el" + tag, sh, tuple(tilt @ Vector((0, -0.27, 0))))
    bm = bmesh.new()
    limb(bm, 0.108, 0.122, 0.22, tilt)
    torus(bm, 0.105, 0.032, tilt @ T(0, -0.235, 0), ring=12)
    o = make("arm_low" + tag, bm, el, M["hood"]); remesh(o, 0.01, 3, 0.5)
    bm = bmesh.new()
    pm = tilt @ T(0, -0.33, 0.01)
    sculpt(bm, lambda d: (d.x * 0.118, d.y * 0.108, d.z * 0.1), pm)
    for i, dx in enumerate((-0.068, 0, 0.068)):
        ball(bm, 0.048, pm @ T(dx, -0.085 - (0.014 if i == 1 else 0), 0.03) @ S(1, 1.25, 1), 24)
    ball(bm, 0.042, pm @ T(-s * 0.105, -0.02, 0.04) @ S(1, 1.2, 1), 24)
    o = make("paw" + tag, bm, el, M["fur"]); remesh(o, 0.008, 4, 0.6)
    bm = bmesh.new(); ball(bm, 0.032, pm @ T(0, -0.02, 0.088) @ S(1.4, 1, 0.5), 20); make("pad" + tag, bm, el, M["white"])

# ---------------------------------------------------------------- legs
for s, tag in ((-1, "L"), (1, "R")):
    hip = node("hip" + tag, body, (s * 0.17, 0.62, 0))
    bm = bmesh.new(); limb(bm, 0.15, 0.127, 0.22); make("leg_up" + tag, bm, hip, M["pants"])
    knee = node("knee" + tag, hip, (0, -0.22, 0))
    bm = bmesh.new(); limb(bm, 0.127, 0.112, 0.2); make("leg_low" + tag, bm, knee, M["pants"])
    foot = node("foot" + tag, knee, (0, -0.27, 0))
    bm = bmesh.new()
    sculpt(bm, lambda d: (d.x * 0.148 * (1 - 0.12 * sm(0, 1, d.z)), max(-0.05, d.y * 0.118 * (1 - 0.25 * sm(-0.2, 1, d.z))), d.z * 0.25 + 0.07))
    torus(bm, 0.105, 0.03, T(0, 0.075, 0), ring=12)
    o = make("shoe" + tag, bm, foot, M["white"]); remesh(o, 0.009, 3, 0.5)
    bm = bmesh.new()
    sculpt(bm, lambda d: (d.x * 0.158 * (1 - 0.12 * sm(0, 1, d.z)), -0.062 + d.y * 0.028, d.z * 0.265 + 0.07))
    ball(bm, 0.06, T(0, 0.035, 0.2) @ S(1.9, 0.5, 1.3), 24)
    make("sole" + tag, bm, foot, M["green"])

# ---------------------------------------------------------------- tail
tail = node("tail", body, (0, 0.74, -0.24))
bm = bmesh.new()


def tail_shape(d):
    t = (d.y + 1) / 2
    w = 0.16 * (0.55 + 0.9 * math.sin(math.pi * min(1.0, t * 0.9 + 0.1)))
    return (d.x * w, t * 0.9 - 0.05, d.z * w - 0.5 * t + 0.28 * t * t - 0.05)


sculpt(bm, tail_shape, R(-0.5))
tail_o = make("tail_mesh", bm, tail, M["skin"])
paint(tail_o, lambda p: mix(mix(FUR, FURD, sm(0.15, 0.6, (R(0.5) @ p).y) * 0.7), WHITE, sm(0.62, 0.8, (R(0.5) @ p).y)))

# ---------------------------------------------------------------- export
bpy.context.view_layer.update()
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT + "/lobo.glb", export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_color_quantization=10)
print("GLB written", sum(len(o.data.vertices) for o in scene.objects if o.type == "MESH"), "vertices")

# ---------------------------------------------------------------- preview renders
if RENDER:
    for o in scene.objects:
        o.select_set(False)
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=14)
    me = bpy.data.meshes.new("floor"); bm.to_mesh(me); bm.free()
    fl = bpy.data.objects.new("floor", me); col.objects.link(fl); me.materials.append(material("floor", 0x0C2A40, 0.62))
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*lin(0x0A2233), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

    def light(name, kind, loc, energy, color, size=4.0):
        d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = lin(color)
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.4)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return o

    light("key", "AREA", (-3.5, -5.5, 6.5), 1700, 0xFFF4E6, 5)
    light("rim", "AREA", (4.5, 5.0, 4.0), 1400, 0x22D3EE, 3)
    light("fill", "AREA", (-5.5, 1.0, 2.6), 160, 0x22C55E, 4)
    cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 70
    cam = bpy.data.objects.new("cam", cam_d); col.objects.link(cam); scene.camera = cam
    scene.render.engine = "CYCLES"; scene.cycles.samples = 40; scene.cycles.use_denoising = True; scene.cycles.device = "CPU"
    scene.render.resolution_x = scene.render.resolution_y = 760
    scene.view_settings.view_transform = "Filmic"; scene.view_settings.look = "Medium High Contrast"
    FINAL = "final" in sys.argv
    if FINAL:
        scene.cycles.samples = 72
        # name, camera, aim, width, height, lens
        VIEWS = (("avatar", (1.1, -3.7, 2.25), (0, 0, 1.92), 1600, 1600, 70),
                 ("cuerpo", (2.4, -8.6, 2.3), (0, 0, 1.28), 1600, 2000, 70),
                 ("tres_cuartos", (-4.3, -7.5, 2.2), (0, 0, 1.28), 1600, 2000, 70),
                 ("banner", (-0.5, -13.0, 2.2), (-1.7, 0, 2.02), 3168, 792, 70))
    else:
        VIEWS = (("frente", (2.2, -7.6, 2.2), (0, 0, 1.3), 760, 760, 70), ("cara", (1.1, -3.7, 2.25), (0, 0, 1.9), 760, 760, 70), ("lado", (7.4, -2.0, 2.0), (0, 0, 1.3), 760, 760, 70))
    # backdrop with a blue glow, used only by the banner (the other views show the floor instead)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
    me = bpy.data.meshes.new("wall"); bm.to_mesh(me); bm.free()
    wall = bpy.data.objects.new("wall", me); col.objects.link(wall); me.materials.append(material("wall", 0x0B2233, 0.95))
    wall.location = (0, 9.0, 3.0); wall.rotation_euler = (math.pi / 2, 0, 0)
    glow = bpy.data.lights.new("glow", "POINT"); glow.energy = 700; glow.color = lin(0x22A5D8); glow.shadow_soft_size = 1.0
    glow_o = bpy.data.objects.new("glow", glow); col.objects.link(glow_o); glow_o.location = (1.0, 7.6, 2.0)
    only = [a[5:] for a in sys.argv if a.startswith("solo_")]
    for name, loc, aim, w, h, lens in [v for v in VIEWS if not only or v[0] in only]:
        scene.render.resolution_x = w; scene.render.resolution_y = h; cam_d.lens = lens
        wall.hide_render = glow_o.hide_render = name != "banner"
        if "prueba" in sys.argv:
            scene.render.resolution_percentage = 30; scene.cycles.samples = 16
        cam.location = loc
        cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = OUT + ("/final/lobo_" if FINAL else "/render_") + name + ".png"
        bpy.ops.render.render(write_still=True)
        print("rendered", name, flush=True)
