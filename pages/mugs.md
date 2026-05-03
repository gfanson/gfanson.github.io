---
layout: default
title: Mugs
permalink: /mugs/
---

<h1>Mugs</h1>

<div class="gallery">
    {% for image in site.static_files %}
        {% if image.path contains '/assets/images/pottery/mugs/' %}
            <img src="{{ image.path }}" alt="Mug">
        {% endif %}
    {% endfor %}
</div>