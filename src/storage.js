import sequelize from 'sequelize';
import {
    Genre,
    Person,
    Title,
    TitleCast,
    TitleDescription,
    TitleEpisode,
    TitleGenre,
    TitleImage,
    TitleMedia,
    TitleName,
    TitleRating,
    TitleSubtitles
} from "./model";

class Backend {
    /**
     * @type Sequelize
     */
    db;

    constructor(db) {
        this.db = db;

        Genre.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            tmdb_id: sequelize.DataTypes.INTEGER,
            name: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'genre',
            indexes: []
        });
        Person.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            imdb_id: sequelize.DataTypes.TEXT,
            name: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'people',
            indexes: []
        });
        Title.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            imdb_id: sequelize.DataTypes.TEXT,
            tmdb_id: sequelize.DataTypes.INTEGER,
            tvdb_id: sequelize.DataTypes.INTEGER,
            original_language: sequelize.DataTypes.TEXT,
            runtime: sequelize.DataTypes.INTEGER,
            year_start: sequelize.DataTypes.INTEGER,
            year_end: sequelize.DataTypes.INTEGER,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title',
            indexes: []
        });
        TitleCast.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            category: sequelize.DataTypes.TEXT,
            characters: {
                type: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
                allowNull: false,
            },
            job: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_cast',
            indexes: []
        });
        TitleCast.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleCast);
        TitleCast.belongsTo(Person, {
            foreignKey: {
                allowNull: false,
            }
        });
        Person.hasMany(TitleCast);

        TitleDescription.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.TEXT,
            languages: {
                type: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
                allowNull: false,
            },
            kind: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
            overview: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
            tagline: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_description',
            indexes: []
        });
        TitleDescription.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleDescription);

        TitleEpisode.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            season_number: sequelize.DataTypes.TEXT,
            episode_number: sequelize.DataTypes.TEXT,
            air_date: sequelize.DataTypes.DATEONLY,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_episode',
            indexes: [
                {
                    fields: [
                        'parent_id',
                        {
                            attribute: 'season_number',
                            collate: 'C',
                            order: 'ASC',
                        },
                        {
                            attribute: 'episode_number',
                            collate: 'C',
                            order: 'ASC',
                        }
                    ]
                },
                {
                    using: 'BTREE',
                    fields: [
                        'parent_id',
                        {
                            attribute: 'air_date',
                            order: 'ASC',
                        }
                    ]
                }
            ]
        });
        TitleEpisode.belongsTo(Title, {
            as: "Parent",
            foreignKey: {
                name: "parent_id",
                allowNull: false,
            }
        })
        Title.belongsTo(TitleEpisode, {
            as: "Parent",
            foreignKey: {
                name: "parent_id",
                allowNull: true,
            }
        })
        TitleGenre.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            title_id: sequelize.DataTypes.UUID,
            genre_id: sequelize.DataTypes.UUID,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_genre',
            indexes: []
        });
        TitleGenre.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleGenre);
        TitleGenre.belongsTo(Genre, {
            foreignKey: {
                allowNull: false,
            }
        });
        Genre.hasMany(TitleGenre);
        TitleImage.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            kind: sequelize.DataTypes.TEXT,
            mime: sequelize.DataTypes.TEXT,
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_image',
            indexes: []
        });
        TitleImage.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleImage);
        TitleMedia.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            mime: sequelize.DataTypes.TEXT,
            codecs: {
                type: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
                allowNull: false,
            },
            languages: {
                type: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
                allowNull: false,
            },
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_media',
            indexes: []
        });
        TitleMedia.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleMedia);
        TitleName.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.TEXT,
            languages: {
                type: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
                allowNull: false,
            },
            kind: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
            name: {
                type: sequelize.DataTypes.TEXT,
                allowNull: false,
            },
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_name',
            indexes: []
        });
        TitleName.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleName);
        TitleRating.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.TEXT,
            certification: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_rating',
            indexes: []
        });
        TitleRating.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleRating);
        TitleSubtitles.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            format: sequelize.DataTypes.TEXT,
            language: sequelize.DataTypes.TEXT,
            region: sequelize.DataTypes.TEXT,
            specifier: sequelize.DataTypes.TEXT,
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_subtitles',
            indexes: []
        });
        TitleSubtitles.belongsTo(Title, {
            foreignKey: {
                allowNull: false,
            }
        });
        Title.hasMany(TitleSubtitles);
    }

    async sync() {
        await Promise.all([
            Genre.sync(), Person.sync(), Title.sync(),
            TitleCast.sync(), TitleDescription.sync(), TitleEpisode.sync(), TitleGenre.sync(), TitleImage.sync(),
            TitleMedia.sync(), TitleName.sync(), TitleRating.sync(), TitleSubtitles.sync(),
        ]);
    }

}

export default Backend;