(function () {
    if (!('URLSearchParams' in window)) return;
    var qs = new window.URLSearchParams(window.location.search);
    if (!qs.get('fbclid')) return;
    qs.delete('fbclid');
    var u = window.location.pathname;
    u += !!qs.toString().length ? '?' + qs.toString() : '';
    window.history.replaceState({}, "", u);
    window.location.reload();
})(window);
